include $(TOPDIR)/rules.mk

LUCI_TITLE:=OUM simplified router manager
LUCI_DEPENDS:=+luci-base +luci-mod-admin-full +luci-app-firewall +luci-app-package-manager +luci-i18n-base-ru +luci-i18n-firewall-ru +luci-i18n-package-manager-ru +luci-proto-ppp +luci-proto-ipv6 +luci-lib-uqr +rpcd-mod-file +rpcd-mod-iwinfo +rpcd-mod-luci +ip-full +ppp +ppp-mod-pppoe +rpcd +rpcd-mod-ucode +uhttpd +uhttpd-mod-ubus +curl +ca-bundle +openssh-client +ruby +ruby-yaml +unzip +jsonfilter +nftables-json +iw +iwinfo +firewall4
LUCI_PKGARCH:=all
PKG_VERSION:=0.0.2
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
