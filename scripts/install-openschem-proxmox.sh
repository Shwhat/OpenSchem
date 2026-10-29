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
# Interactive menu layer modeled on Proxmox Community Scripts.
# No host packages are installed automatically; whiptail is normally present on PVE.
# Interact with the actual terminal, even if launched through a pipe or bash -c.
# YES=1 retains explicit noninteractive behavior for automation.
if [[ "$YES" != 1 ]]; then
  [[ -r /dev/tty && -w /dev/tty ]] || fail 'No interactive terminal available. Open the Proxmox node Shell or use SSH.'
  command -v whiptail >/dev/null || fail 'whiptail is missing. Install with: apt-get update && apt-get install -y whiptail'
fi

menu() {
  local title="$1" prompt="$2"; shift 2
  whiptail --backtitle "OpenSchem - Proxmox VE" --title "$title" --menu "$prompt" 20 76 11 "$@" 3>&1 1>&2 2>&3 </dev/tty
}
input() {
  local title="$1" prompt="$2" value="$3"
  whiptail --backtitle "OpenSchem - Proxmox VE" --title "$title" --inputbox "$prompt" 12 76 "$value" 3>&1 1>&2 2>&3 </dev/tty
}
choose_storage_menu() {
  local content="$1" title="$2" chosen
  local -a opts=()
  while read -r name; do
    [[ -n "$name" ]] && opts+=("$name" "Active; supports $content")
  done < <(pvesm status --content "$content" | awk 'NR>1 && $3=="active" {print $1}')
  (("${#opts[@]}" > 0)) || fail "No active $content storage."
  chosen=$(menu "$title" "Choose Proxmox storage" "${opts[@]}") || exit 0
  printf '%s' "$chosen"
}
choose_bridge_menu() {
  local -a opts=()
  local path name
  for path in /sys/class/net/vmbr*; do
    [[ -e "$path" ]] || continue
    name="${path##*/}"
    opts+=("$name" "Proxmox Linux bridge")
  done
  (("${#opts[@]}" > 0)) || fail "No vmbr bridges detected."
  menu 'Network Bridge' 'Select bridge for the LXC' "${opts[@]}"
}
choose_vlan_menu() {
  local -a opts=("untagged" "Untagged / native network" "custom" "Enter a VLAN ID (1–4094)")
  local ids="" id conf
  # VLAN tags used by existing containers plus bridge-vids configured by PVE.
  ids=$( { grep -hEo 'tag=[0-9]+' /etc/pve/lxc/*.conf 2>/dev/null || true
          grep -hE 'bridge-vids' /etc/network/interfaces /etc/network/interfaces.d/* 2>/dev/null | grep -Eo '[0-9]{1,4}' || true; } | sed -E 's/^tag=//' | sort -nu | awk '$1>=1 && $1<=4094' | head -n 30)
  while read -r id; do
    [[ -n "$id" ]] && opts+=("$id" "Detected on host")
  done <<< "$ids"
  conf=$(menu 'Network VLAN' 'Choose an available VLAN or enter your own. The selected bridge must carry the VLAN.' "${opts[@]}") || exit 0
  if [[ "$conf" == custom ]]; then
    conf=$(input 'Custom VLAN ID' 'Enter VLAN ID 1–4094' '') || exit 0
  fi
  printf '%s' "$conf"
}
choose_ctid_menu() {
  local next candidate count=0 selected
  local -a opts=()
  next=$(pvesh get /cluster/nextid) || fail 'Cannot determine available container IDs'
  candidate="$next"
  while (( count < 12 )); do
    if ! pct config "$candidate" >/dev/null 2>&1 && ! qm config "$candidate" >/dev/null 2>&1; then
      opts+=("$candidate" "$([[ $count == 0 ]] && echo 'Recommended' || echo 'Available')")
      ((count+=1))
    fi
    ((candidate+=1))
  done
  opts+=("custom" "Enter any unused container ID")
  selected=$(menu 'Container ID' 'Choose an unused LXC ID' "${opts[@]}") || exit 0
  if [[ "$selected" == custom ]]; then
    selected=$(input 'Custom Container ID' 'Enter an unused ID (100 or higher)' "$next") || exit 0
  fi
  printf '%s' "$selected"
}
if [[ "$YES" != 1 ]]; then
  whiptail --backtitle "OpenSchem - Proxmox VE" --title "OpenSchem LXC" --yesno \
    "Install OpenSchem in a new Debian LXC container?\\n\\nDefault settings will still let you choose the Container ID, network bridge, VLAN, and storage." \
    15 76 </dev/tty || exit 0
  MODE=$(menu 'OpenSchem Installer' 'Choose the setup experience' \
     default 'Recommended values; select ID, bridge, VLAN and storage' \
     advanced 'Configure OS, resources, IP and application options') || exit 0
  CTID=$(choose_ctid_menu)
  BRIDGE=$(choose_bridge_menu) || exit 0
  VLAN=$(choose_vlan_menu)
  TEMPLATE_STORAGE=$(choose_storage_menu vztmpl 'Template Storage')
  DISK_STORAGE=$(choose_storage_menu rootdir 'Container Disk Storage')
  if [[ "$MODE" == advanced ]]; then
    OS_VERSION=$(menu 'Debian Version' 'Choose Debian version' 13 'Debian 13 (Trixie)' 12 'Debian 12 (Bookworm)') || exit 0
    CT_NAME=$(input 'Hostname' 'LXC hostname' "$CT_NAME") || exit 0
    CORES=$(input 'CPU Cores' 'Number of virtual CPU cores' "$CORES") || exit 0
    MEMORY=$(input 'Memory' 'RAM in MiB' "$MEMORY") || exit 0
    SWAP=$(input 'Swap' 'Swap in MiB' "$SWAP") || exit 0
    DISK=$(input 'Disk Size' 'Root filesystem size in GiB' "$DISK") || exit 0
    IP=$(menu 'IP Configuration' 'Choose addressing method' dhcp 'Automatic (DHCP)' static 'Static IPv4') || exit 0
    if [[ "$IP" == static ]]; then
      IP=$(input 'Static IP' 'Enter IPv4 address/CIDR (example: 192.168.1.50/24)' '') || exit 0
      GATEWAY=$(input 'Gateway' 'Enter IPv4 gateway address' "$GATEWAY") || exit 0
    fi
    DNS=$(input 'DNS Server' 'Optional DNS server; blank uses Proxmox defaults' "$DNS") || exit 0
    PORT=$(input 'Web Port' 'Host port forwarded to OpenSchem (8080)' "$PORT") || exit 0
    SIGNUP=$(menu 'Registration' 'Allow creating new user accounts?' on 'Yes, create accounts from the login page' off 'No, existing accounts only') || exit 0
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
  [[ -r /dev/tty ]] || fail 'Noninteractive mode requires YES=1.'
  summary="LXC: $CTID ($CT_NAME), Debian $OS_VERSION\\nCPU: $CORES   RAM: $MEMORY MiB   Disk: $DISK GiB\\nStorage: $DISK_STORAGE\\nBridge: $BRIDGE   VLAN: $VLAN\\nIP: $IP   Web port: $PORT\\n\\nCreate this new container?"
  whiptail --backtitle "OpenSchem - Proxmox VE" --title 'Confirm Installation' --yesno "$summary" 17 76 </dev/tty || { echo 'Cancelled.'; exit 0; }
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