#!/usr/bin/env bash
# Run as root on a Proxmox VE host. Creates a NEW unprivileged Debian LXC.
set -Eeuo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }
command -v pct >/dev/null || die "This script must run on a Proxmox host."
command -v pveam >/dev/null || die "pveam is missing."
command -v pvesm >/dev/null || die "pvesm is missing."
[[ $EUID -eq 0 ]] || die "Run as root."

# Customize via environment variables, e.g. CTID=250 DISK_STORAGE=local-lvm bash install-openschem.sh
CTID="${CTID:-$(pvesh get /cluster/nextid 2>/dev/null)}"
HOSTNAME="${HOSTNAME:-openschem}"
BRIDGE="${BRIDGE:-vmbr0}"
MEMORY="${MEMORY:-2048}"
CORES="${CORES:-2}"
DISK_SIZE="${DISK_SIZE:-16}"
NET_CONFIG="${NET_CONFIG:-dhcp}"
SIGNUP="${SIGNUP:-on}"
PORT="${PORT:-8080}"
DEBIAN_VERSION="${DEBIAN_VERSION:-12}"

[[ "$CTID" =~ ^[0-9]+$ ]] || die "CTID must be numeric."
[[ "$PORT" =~ ^[0-9]+$ ]] && ((PORT >= 1 && PORT <= 65535)) || die "PORT must be 1–65535."
[[ "$SIGNUP" == on || "$SIGNUP" == off ]] || die "SIGNUP must be on or off."
[[ -d "/sys/class/net/$BRIDGE" ]] || die "Bridge $BRIDGE does not exist."
if pct config "$CTID" >/dev/null 2>&1 || qm config "$CTID" >/dev/null 2>&1; then
  die "VM/CT ID $CTID is already in use; nothing was changed."
fi

choose_storage() {
  local content="$1" preferred="$2" candidate
  if [[ -n "$preferred" ]]; then
    pvesm status --content "$content" | awk 'NR>1{print $1}' | grep -Fxq "$preferred" ||
      die "Storage '$preferred' is not available for $content."
    printf '%s' "$preferred"
    return
  fi
  for candidate in local-lvm local-zfs local; do
    if pvesm status --content "$content" | awk 'NR>1{print $1}' | grep -Fxq "$candidate"; then
      printf '%s' "$candidate"; return
    fi
  done
  pvesm status --content "$content" | awk 'NR==2{print $1}'
}
TEMPLATE_STORAGE="$(choose_storage vztmpl "${TEMPLATE_STORAGE:-}")"
DISK_STORAGE="$(choose_storage rootdir "${DISK_STORAGE:-}")"
[[ -n "$TEMPLATE_STORAGE" && -n "$DISK_STORAGE" ]] || die "Could not find suitable template and root filesystem storage."

echo "New LXC: $CTID ($HOSTNAME), Debian $DEBIAN_VERSION"
echo "CPU/RAM/Disk: $CORES cores / ${MEMORY}MB / ${DISK_SIZE}GB"
echo "Network: $BRIDGE, $NET_CONFIG | Web port: $PORT"
echo "Storage: template=$TEMPLATE_STORAGE, disk=$DISK_STORAGE"
echo "This creates a new container. Existing containers are not changed."
if [[ "${ASSUME_YES:-0}" != 1 ]]; then
  read -r -p "Proceed? [y/N] " response
  [[ "$response" =~ ^[Yy]$ ]] || exit 0
fi

log "Finding Debian LXC template"
pveam update
TEMPLATE="$(pveam available --section system | awk -v v="$DEBIAN_VERSION" '$2 ~ ("^debian-" v "-standard_") {print $2}' | sort -V | tail -1)"
[[ -n "$TEMPLATE" ]] || die "No Debian $DEBIAN_VERSION standard template in Proxmox appliance index."
TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"
if ! pveam list "$TEMPLATE_STORAGE" | grep -Fq "$TEMPLATE"; then
  log "Downloading $TEMPLATE"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

log "Creating unprivileged LXC $CTID"
NET0="name=eth0,bridge=$BRIDGE,ip=$NET_CONFIG"
# Optional static network: NET_CONFIG=192.168.1.60/24 GATEWAY=192.168.1.1
if [[ "$NET_CONFIG" != dhcp ]]; then
  [[ -n "${GATEWAY:-}" ]] || die "GATEWAY is required for static NET_CONFIG."
  NET0+=",gw=$GATEWAY"
fi
pct create "$CTID" "$TEMPLATE_REF" \
  --hostname "$HOSTNAME" --ostype debian \
  --cores "$CORES" --memory "$MEMORY" --swap 512 \
  --rootfs "${DISK_STORAGE}:${DISK_SIZE}" \
  --net0 "$NET0" --nameserver "${DNS_SERVER:-1.1.1.1}" \
  --unprivileged 1 --features nesting=1,keyctl=1 \
  --onboot 1 --start 0

log "Starting LXC"
pct start "$CTID"
# Allow networking/DNS to come up
sleep 5

BOOTSTRAP="$(mktemp /tmp/openschem-bootstrap.XXXXXX)"
trap 'rm -f "$BOOTSTRAP"' EXIT
cat > "$BOOTSTRAP" <<'GUEST_SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
ARCH="$(dpkg --print-architecture)"
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $VERSION_CODENAME
Components: stable
Architectures: $ARCH
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
mkdir -p /opt/openschem
cat > /opt/openschem/docker-compose.yml <<EOF
services:
  openschem:
    image: ghcr.io/shwhat/openschem:latest
    container_name: openschem
    restart: unless-stopped
    ports:
      - "$APP_PORT:8080"
    volumes:
      - openschem-data:/data
    environment:
      OPENSCHEM_SIGNUP: "$APP_SIGNUP"
      OPENSCHEM_SECURE_COOKIE: "auto"
volumes:
  openschem-data:
EOF
cd /opt/openschem
docker compose pull
docker compose up -d
docker compose ps
GUEST_SCRIPT
chmod 700 "$BOOTSTRAP"
pct push "$CTID" "$BOOTSTRAP" /root/openschem-bootstrap.sh
log "Installing Docker and OpenSchem inside LXC"
pct exec "$CTID" -- env APP_PORT="$PORT" APP_SIGNUP="$SIGNUP" bash /root/openschem-bootstrap.sh
pct exec "$CTID" -- rm -f /root/openschem-bootstrap.sh
log "Deployment finished"
IP="$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}' || true)"
echo "LXC ID: $CTID"
echo "OpenSchem URL: http://${IP:-YOUR_LXC_IP}:$PORT"
echo "Status: pct exec $CTID -- docker ps"
echo "Logs: pct exec $CTID -- docker logs openschem --tail 100"
echo "Update: pct exec $CTID -- bash -lc 'cd /opt/openschem && docker compose pull && docker compose up -d'"
echo "Back up the LXC (including the Docker volume in /var/lib/docker/volumes)."
