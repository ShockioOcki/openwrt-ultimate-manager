include $(TOPDIR)/rules.mk

LUCI_TITLE:=OUM simplified router manager
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +uhttpd +curl +ruby +ruby-yaml
LUCI_PKGARCH:=all
PKG_VERSION:=0.2.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
