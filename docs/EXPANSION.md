# Network and USB expansion

OUM treats wireless mesh, USB storage and USB mobile networking as separate
capabilities. A router can support any combination of them, so the UI must not
infer Mesh support from the presence of a USB port.

## Capability discovery

The backend will report capabilities without changing the router:

- `mesh_driver`: at least one PHY advertises `mesh point` mode;
- `mesh_runtime`: an installed wpad variant provides 802.11s support;
- `usb_host`: a USB host controller is present;
- `usb_storage`: a block device is attached;
- `usb_network`: a USB-backed network interface is attached;
- `usb_modem`: a supported QMI, MBIM or NCM control device is attached.

The first-run wizard only reports detected optional capabilities. Their setup
lives in Settings and runs after WAN and Wi-Fi are known to work.

## Mesh

Mesh does not require USB. OUM exposes three states: disabled, create a Mesh,
and join a Mesh. The simplified form asks for the Mesh ID, a dedicated key and
the backhaul band. The normal client SSID remains a separate AP interface.

The first implementation uses an encrypted 802.11s backhaul on a fixed channel.
It does not claim seamless roaming by itself; 802.11k/v/r steering is a later,
separately tested feature. Dual-band devices can share the 5 GHz radio between
AP and backhaul at a performance cost, while a future tri-band target may
dedicate a radio to backhaul.

Installing Mesh may require replacing `wpad-basic-*` with `wpad-mesh-*`. OUM
must verify available storage and packages before replacement, keep the old
package list, and never reload wireless until the new runtime is installed and
the generated configuration passes validation. A reconnect watchdog restores
the previous wireless configuration unless the user confirms the new link.

## USB mobile connection

OUM detects the device before offering a protocol. Supported families are:

- RNDIS/CDC Ethernet and HiLink-style devices: DHCP over the USB interface;
- NCM;
- MBIM;
- QMI.

The form contains APN, optional PIN and credentials as write-only fields. The
user chooses whether mobile WAN is the primary connection or a backup. Backup
mode is the default and uses health checks plus controlled failover; it must not
silently send traffic through a metered modem while wired WAN is healthy.

Drivers are selected from the detected USB identifiers and interfaces. OUM
does not install all modem packages blindly. DNS supplied by a modem does not
replace the router-wide OUM DNS policy without an explicit design change.

## USB storage

Storage setup is independent from mobile networking. The initial scope is a
stable mount, Samba share, Aria2 with AriaNG, download directories and MiniDLNA.
Existing filesystems are mounted without formatting. Formatting is a separate,
destructive action that names the exact device and requires explicit
confirmation.

## Hardware test sequence

1. Record board, kernel, USB identifiers, interfaces and installed packages.
2. Test USB Ethernet/DHCP without changing the current wired WAN.
3. Test the modem's native QMI/MBIM/NCM mode when present.
4. Add backup-WAN policy and verify failover and recovery in both directions.
5. Attach storage, verify mount persistence, then add NAS services one at a
   time.
6. Test Mesh with two compatible routers only after ordinary AP recovery has
   been verified.

