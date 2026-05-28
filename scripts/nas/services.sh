#!/bin/sh
# OUM NAS — Service configurations

CONFIG_DIR="/mnt/nas/config"

qbittorrent_fix_password() {
    inf "Установка пароля qBittorrent: admin..."
    mkdir -p "$CONFIG_DIR/qbittorrent/qBittorrent/config"
    cat > "$CONFIG_DIR/qbittorrent/qBittorrent/config/qBittorrent.conf" << 'QBITCONF'
[BitTorrent]
Session\DefaultSavePath=/downloads
Session\TempPath=/downloads/incomplete
Session\AddExtensionToIncompleteFiles=true

[Preferences]
WebUI\Port=8080
WebUI\LocalHostAuth=false
WebUI\Username=admin
WebUI\Password_PBKDF2="@ByteArray(ARQ77eY1NUZaQsuDHbIMCA==:0WMRkYTUWVT9wVvdDtHAjU9b3b7uB8NR1Gur2hmQCvDCpmvs7yWaWXMgrULczQJeEaJdzOJqEiWsBlG34Hk0vg==:10000)"
Downloads\SavePath=/downloads
Downloads\TempPath=/downloads/incomplete
QBITCONF
}

jellyfin_ru_config() {
    inf "Настройка Jellyfin на русский..."
    mkdir -p "$CONFIG_DIR/jellyfin/config/config"
    cat > "$CONFIG_DIR/jellyfin/config/config/system.xml" << 'JELLYCONF'
<?xml version="1.0" encoding="utf-8"?>
<ServerConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <LogFileRetentionDays>3</LogFileRetentionDays>
  <IsStartupWizardCompleted>false</IsStartupWizardCompleted>
  <EnableUPnP>false</EnableUPnP>
  <PublicPort>8096</PublicPort>
  <PublicHttpsPort>8920</PublicHttpsPort>
  <HttpServerPortNumber>8096</HttpServerPortNumber>
  <HttpsPortNumber>8920</HttpsPortNumber>
  <EnableHttps>false</EnableHttps>
  <CertificatePath></CertificatePath>
  <CertificatePassword></CertificatePassword>
  <AutoRunWebApp>false</AutoRunWebApp>
  <AutoDiscovery>true</AutoDiscovery>
  <EnableRemoteAccess>true</EnableRemoteAccess>
  <KnownProxies></KnownProxies>
  <EnablePublishedServerUriByRequest>false</EnablePublishedServerUriByRequest>
  <QuickConnectAvailable>false</QuickConnectAvailable>
  <EnableCaseSensitiveItemIds>false</EnableCaseSensitiveItemIds>
  <MetadataPath></MetadataPath>
  <MetadataNetworkPath></MetadataNetworkPath>
  <PreferredMetadataLanguage>ru</PreferredMetadataLanguage>
  <MetadataCountryCode>RU</MetadataCountryCode>
  <SortReplaceCharacters></SortReplaceCharacters>
  <SortRemoveCharacters></SortRemoveCharacters>
  <SortRemoveWords></SortRemoveWords>
  <LibraryMonitorDelay>60</LibraryMonitorDelay>
  <LibraryUpdateDuration>30</LibraryUpdateDuration>
  <ImageSavingConvention>Compatible</ImageSavingConvention>
  <EnableAutomaticRestart>false</EnableAutomaticRestart>
  <SkipDeserializationForBasicTypes>false</SkipDeserializationForBasicTypes>
  <ServerName></ServerName>
  <BaseUrl></BaseUrl>
  <UICulture>ru-RU</UICulture>
  <SaveMetadataHidden>false</SaveMetadataHidden>
  <ContentTypes></ContentTypes>
  <RemoteClientBitrateLimit>0</RemoteClientBitrateLimit>
  <EnableFolderView>false</EnableFolderView>
  <EnableGroupingIntoCollections>false</EnableGroupingIntoCollections>
  <DisplaySpecialsWithinSeasons>true</DisplaySpecialsWithinSeasons>
  <CodecsUsed></CodecsUsed>
  <PluginRepositories>
    <RepositoryInfo>
      <Name>Jellyfin Stable</Name>
      <Url>https://repo.jellyfin.org/releases/plugin/manifest-stable.json</Url>
      <Enabled>true</Enabled>
    </RepositoryInfo>
  </PluginRepositories>
  <ImageExtractionTimeoutMs>0</ImageExtractionTimeoutMs>
  <PathSubstitutions></PathSubstitutions>
  <EnableSlowResponseWarning>true</EnableSlowResponseWarning>
  <SlowResponseThresholdMs>500</SlowResponseThresholdMs>
  <CorsHosts></CorsHosts>
  <ActivityLogRetentionDays>30</ActivityLogRetentionDays>
  <LibraryScanFanoutConcurrency>0</LibraryScanFanoutConcurrency>
  <LibraryMetadataRefreshConcurrency>0</LibraryMetadataRefreshConcurrency>
  <RemoveOldPlugins>false</RemoveOldPlugins>
  <AllowClientLogUpload>true</AllowClientLogUpload>
  <DummyChapterDuration>300</DummyChapterDuration>
  <ChapterImageResolution>MatchSource</ChapterImageResolution>
  <EnableExternalContentInSuggestions>false</EnableExternalContentInSuggestions>
  <RequireHttps>false</RequireHttps>
</ServerConfiguration>
JELLYCONF
}

aria2_config() {
    inf "Настройка Aria2..."
    mkdir -p "$CONFIG_DIR/aria2"
    cat > "$CONFIG_DIR/aria2/aria2.conf" << 'ARIA2CONF'
dir=/downloads/complete
max-connection-per-server=16
split=16
min-split-size=10M
seed-time=0
bt-stop-timeout=600
enable-dht=true
enable-peer-exchange=true
bt-enable-lpd=true
enable-rpc=true
rpc-listen-port=6800
rpc-listen-all=true
rpc-allow-origin-all=true
disable-ipv6=true
input-file=/config/aria2.session
save-session=/config/aria2.session
ARIA2CONF
    touch "$CONFIG_DIR/aria2/aria2.session"
}

cfg_services() {
    hdr "=== Настройка сервисов ==="
    qbittorrent_fix_password
    jellyfin_ru_config
    aria2_config
    ok "Конфиги созданы"
}
