#
# luci-theme-oum — OUM "Домашний диспетчерский щит" как системная тема LuCI
# seed 304ab282 · tokens #eef0ea/#172c28/#2868d7
# Совместимый каркас LuCI + визуальный язык OUM/TailAdmin
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-oum
OUM_VERSION?=1.1.0
OUM_RELEASE?=1

PKG_VERSION:=$(OUM_VERSION)
PKG_RELEASE:=$(OUM_RELEASE)

LUCI_TITLE:=OUM — Домашний диспетчерский щит (тема LuCI)
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

define Package/$(PKG_NAME)/conffiles
/etc/config/oum_theme
endef

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	[ -f /etc/uci-defaults/30_luci-theme-oum ] && sh /etc/uci-defaults/30_luci-theme-oum >/dev/null 2>&1 || true
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache >/dev/null 2>&1 || true
	/etc/init.d/uhttpd reload >/dev/null 2>&1 || /etc/init.d/uhttpd restart >/dev/null 2>&1 || true
}
exit 0
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache >/dev/null 2>&1 || true
	/etc/init.d/uhttpd reload >/dev/null 2>&1 || /etc/init.d/uhttpd restart >/dev/null 2>&1 || true
}
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
