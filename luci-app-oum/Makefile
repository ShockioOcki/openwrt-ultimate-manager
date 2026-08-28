include $(TOPDIR)/rules.mk

LUCI_TITLE:=OUM simplified router manager
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode +uhttpd +uhttpd-mod-ubus +curl +ca-bundle +ruby +ruby-yaml +unzip +jsonfilter +nftables-json +iw +iwinfo +dnsmasq +firewall4
LUCI_PKGARCH:=all
PKG_VERSION:=0.4.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
