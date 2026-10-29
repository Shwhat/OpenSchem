#!/usr/bin/env bash
# OpenSchem for Proxmox VE — self-contained host-side LXC installer.
# Run on a Proxmox node as root. Creates a NEW LXC; never modifies an existing one.
set -Eeuo pipefail

APP="OpenSchem"
CTID="${CTID:-}"
VLAN="${VLAN:-untagged}"
CT_NAME="${CT_NAME:-openschem}"
OS_VERSION="${OS_VERSION:-12}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-2048}"
SWAP="${SWAP:-512}"
DISK="${DISK:-16}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"
GATEWAY="${GATEWAY:-}"
DNS="${DNS:-}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-}"
DISK_STORAGE="${DISK_STORAGE:-}"
PORT="${PORT:-8080}"
IMAGE="${IMAGE:-ghcr.io/shwhat/openschem:latest}"
SIGNUP="${SIGNUP:-on}"
YES="${YES:-0}"
LOG_FILE="/root/openschem-proxmox-install-$(date +%Y%m%d-%H%M%S).log"
GUEST_TEMP=""
CREATED=0
STAGE="preflight"

info() { printf '\n\033[1;36m[OpenSchem] %s\033[0m\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
cleanup() { [[ -z "$GUEST_TEMP" ]] || rm -f "$GUEST_TEMP"; }
error_handler() {
  local rc=$?
  echo "Installation failed during: $STAGE (exit $rc)" >&2
  echo "Host log: $LOG_FILE" >&2
  if (( CREATED )); then
    echo "LXC $CTID was preserved for troubleshooting (not deleted)." >&2
    echo "Run: pct enter $CTID" >&2
    echo "Run: pct exec $CTID -- tail -100 /root/openschem-install.log" >&2
  fi
}
trap cleanup EXIT
trap error_handler ERR

[[ $EUID -eq 0 ]] || fail 'Run as root on the Proxmox host.'
for cmd in pct qm pvesh pveam pvesm awk curl; do
  command -v "$cmd" >/dev/null || fail "Missing '$cmd'. Is this a Proxmox host?"
done
[[ -d /etc/pve ]] || fail 'Proxmox cluster filesystem not found.'
command -v whiptail >/dev/null && DIALOG=1 || DIALOG=0

# Only prompt when running interactively and no custom configuration was supplied.
if [[ -t 0 && "$YES" != 1 ]]; then
  if (( DIALOG )); then
    MODE=$(whiptail --title 'OpenSchem Proxmox Installer' --menu 'Choose setup mode' 15 66 2 \
      'default' 'Automatic settings (recommended)' \
      'advanced' 'Customize LXC resources and networking' 3>&1 1>&2 2>&3) || exit 0
  else
    printf 'OpenSchem installer\n1) Default settings\n2) Advanced settings\n'
    read -r -p 'Choice [1]: ' choice
    [[ ${choice:-1} == 2 ]] && MODE=advanced || MODE=default
  fi
  # Always ask about container ID and VLAN, including Default mode.
  ask() {
    local name="$1" current="${!1}" response
    read -r -p "$name [$current]: " response
    [[ -z "$response" ]] || printf -v "$name" '%s' "$response"
  }
  [[ -n "$CTID" ]] || CTID="$(pvesh get /cluster/nextid)"
  printf '\nContainer ID (must be unused; suggested %s):\n' "$CTID"
  ask CTID
  printf '\nVLAN tag (1-4094), or untagged for no VLAN tag:\n'
  ask VLAN
  if [[ "$MODE" == advanced ]]; then
    ask CT_NAME; ask OS_VERSION; ask CORES; ask MEMORY; ask DISK
    ask BRIDGE; ask IP
    if [[ "$IP" != dhcp ]]; then ask GATEWAY; fi
    ask PORT; ask TEMPLATE_STORAGE; ask DISK_STORAGE
  fi
fi

[[ -n "$CTID" ]] || CTID="$(pvesh get /cluster/nextid)"
[[ "$CTID" =~ ^[0-9]+$ ]] && (( CTID>=100 )) || fail 'CTID must be >=100.'
[[ "$VLAN" == untagged || ( "$VLAN" =~ ^[0-9]+$ && "$VLAN" -ge 1 && "$VLAN" -le 4094 ) ]] || fail 'VLAN must be untagged or an integer between 1 and 4094.' 
[[ "$OS_VERSION" == 12 || "$OS_VERSION" == 13 ]] || fail 'OS_VERSION must be 12 or 13.'
for n in "$CORES" "$MEMORY" "$SWAP" "$DISK" "$PORT"; do
  [[ "$n" =~ ^[0-9]+$ ]] || fail 'CPU, RAM, swap, disk, and port must be integers.'
done
(( CORES >= 1 && MEMORY >= 512 && DISK >= 8 && PORT >= 1 && PORT <= 65535 )) || fail 'Invalid resource or port value.'
[[ "$SIGNUP" == on || "$SIGNUP" == off ]] || fail 'SIGNUP must be on or off.'
[[ "$CT_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || fail 'Invalid hostname.'
[[ -d /sys/class/net/$BRIDGE ]] || fail "Network bridge $BRIDGE not found."
[[ "$IP" == dhcp || "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ ]] || fail 'IP must be dhcp or IPv4/CIDR.'
[[ "$IP" == dhcp || -n "$GATEWAY" ]] || fail 'A static IP requires GATEWAY.'
[[ "$BRIDGE" != *','* && "$GATEWAY" != *','* && "$DNS" != *','* ]] || fail 'Invalid network option.'
[[ "$IMAGE" =~ ^[a-zA-Z0-9._:/-]+$ ]] || fail 'Invalid Docker image.'
if pct config "$CTID" >/dev/null 2>&1 || qm config "$CTID" >/dev/null 2>&1; then
  fail "VM or LXC $CTID already exists. Choose a different CTID."
fi

# Select active storage that supports the desired content.
choose_storage() {
  local content="$1" specified="$2" available item
  available=$(pvesm status --content "$content" | awk 'NR>1 && $3=="active" {print $1}')
  [[ -n "$available" ]] || fail "No active storage supports $content."
  if [[ -n "$specified" ]]; then
    grep -Fxq "$specified" <<< "$available" || fail "$specified cannot store $content."
    printf '%s' "$specified"; return
  fi
  if [[ "$content" == vztmpl ]]; then
    for item in local; do
      grep -Fxq "$item" <<< "$available" && { printf '%s' "$item"; return; }
    done
  else
    for item in local-lvm local-zfs local; do
      grep -Fxq "$item" <<< "$available" && { printf '%s' "$item"; return; }
    done
  fi
  head -n1 <<< "$available"
}
TEMPLATE_STORAGE=$(choose_storage vztmpl "$TEMPLATE_STORAGE")
DISK_STORAGE=$(choose_storage rootdir "$DISK_STORAGE")

printf '\nOpenSchem Proxmox install plan\n'
printf '  Container: %s (%s), Debian %s (unprivileged)\n' "$CTID" "$CT_NAME" "$OS_VERSION"
printf '  Resources: %s cores, %s MiB RAM, %s GiB disk\n' "$CORES" "$MEMORY" "$DISK"
printf '  Storage: %s (templates), %s (root disk)\n' "$TEMPLATE_STORAGE" "$DISK_STORAGE"
printf '  Network: bridge=%s, VLAN=%s, address=%s, gateway=%s\n' "$BRIDGE" "$VLAN" "$IP" "${GATEWAY:--}"
printf '  OpenSchem: %s, port %s, signup %s\n' "$IMAGE" "$PORT" "$SIGNUP"
printf '  The LXC has no default root password; use pct enter %s.\n' "$CTID"
if [[ "$YES" != 1 ]]; then
  [[ -t 0 ]] || fail 'Noninteractive mode requires YES=1.'
  read -r -p 'Type YES to create this container: ' answer
  [[ "$answer" == YES ]] || { echo 'Cancelled.'; exit 0; }
fi

# Record all host-side installation output and errors.
exec > >(tee -a "$LOG_FILE") 2>&1
STAGE='download template'
info "Looking up Debian $OS_VERSION template"
pveam update
TEMPLATE=$(pveam available --section system | awk -v version="$OS_VERSION" '$2 ~ ("^debian-" version "-standard_") {print $2}' | sort -V | tail -n1)
[[ -n "$TEMPLATE" ]] || fail "No Debian $OS_VERSION template found."
if ! pveam list "$TEMPLATE_STORAGE" | grep -Fq "$TEMPLATE"; then
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

STAGE='create LXC'
info "Creating LXC $CTID"
NET0="name=eth0,bridge=$BRIDGE,ip=$IP"
[[ "$VLAN" == untagged ]] || NET0+=",tag=$VLAN"
[[ "$IP" == dhcp ]] || NET0+=",gw=$GATEWAY"
CT_ARGS=(--hostname "$CT_NAME" --ostype debian --cores "$CORES" --memory "$MEMORY"
  --swap "$SWAP" --rootfs "$DISK_STORAGE:$DISK" --net0 "$NET0"
  --unprivileged 1 --features nesting=1,keyctl=1 --onboot 1 --start 0)
[[ -z "$DNS" ]] || CT_ARGS+=(--nameserver "$DNS")
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" "${CT_ARGS[@]}"
CREATED=1

STAGE='start LXC'
pct start "$CTID"

STAGE='wait for networking'
info 'Waiting for the LXC to obtain an IP and DNS'
READY=0
for attempt in {1..36}; do
  if pct exec "$CTID" -- bash -c 'getent ahostsv4 download.docker.com >/dev/null && test -n "$(hostname -I)"' >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 5
done
(( READY )) || fail 'LXC has no working IP/DNS. Check DHCP, bridge, gateway and firewall.'

STAGE='install Docker and OpenSchem'
info 'Installing Docker and deploying OpenSchem inside the LXC'
GUEST_TEMP=$(mktemp /tmp/openschem-guest.XXXXXXXX)
cat > "$GUEST_TEMP" <<'GUEST'
#!/usr/bin/env bash
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
exec > >(tee -a /root/openschem-install.log) 2>&1
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl --retry 3 -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
ARCH=$(dpkg --print-architecture)
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker info >/dev/null
mkdir -p /opt/openschem
cat > /opt/openschem/compose.yaml <<EOF
services:
  openschem:
    image: ${APP_IMAGE}
    container_name: openschem
    restart: unless-stopped
    ports:
      - "${APP_PORT}:8080"
    volumes:
      - openschem-data:/data
    environment:
      OPENSCHEM_SIGNUP: "${APP_SIGNUP}"
      OPENSCHEM_SECURE_COOKIE: "auto"
volumes:
  openschem-data:
EOF
cd /opt/openschem
docker compose config -q
docker compose pull
docker compose up -d --no-build
for attempt in $(seq 1 30); do
  HEALTH=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' openschem 2>/dev/null || true)
  [[ "$HEALTH" == healthy || "$HEALTH" == running ]] && { echo "OpenSchem status: $HEALTH"; exit 0; }
  [[ "$HEALTH" == exited || "$HEALTH" == unhealthy ]] && break
  sleep 2
done
docker compose logs --tail 80
exit 1
GUEST
chmod 600 "$GUEST_TEMP"
pct push "$CTID" "$GUEST_TEMP" /root/openschem-install.sh
pct exec "$CTID" -- env APP_IMAGE="$IMAGE" APP_PORT="$PORT" APP_SIGNUP="$SIGNUP" bash /root/openschem-install.sh
pct exec "$CTID" -- rm -f /root/openschem-install.sh
STAGE='complete'
LXC_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}' || true)
info 'OpenSchem installation complete'
printf '  Container ID: %s\n' "$CTID"
printf '  Web UI: http://%s:%s\n' "${LXC_IP:-YOUR_LXC_IP}" "$PORT"
printf '  Sign-in: no default credentials; create a user on the web interface.\n'
printf '  LXC shell: pct enter %s\n' "$CTID"
printf '  Status: pct exec %s -- docker ps\n' "$CTID"
printf '  Logs: pct exec %s -- docker logs openschem --tail 100\n' "$CTID"
printf '  Update: pct exec %s -- bash -lc '\''cd /opt/openschem && docker compose pull && docker compose up -d'\''\n' "$CTID"
printf '  Host install log: %s\n' "$LOG_FILE"
printf '  Backups: include LXC Docker volume at /var/lib/docker/volumes.\n'