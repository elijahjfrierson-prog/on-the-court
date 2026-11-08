; On-The-Court-Windows-Setup.exe: EULA must be accepted, installs to Program Files.
#define MyAppName "On The Court"
#define MyAppVersion "0.1.0"
#define MyAppExeName "On The Court.exe"
[Setup]
AppId={{6F0C2B7E-3D2A-4E7F-9A11-ONTHECOURT01}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=HumHouse
DefaultDirName={autopf}\HumHouse\{#MyAppName}
DefaultGroupName=HumHouse
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE.txt
OutputDir=..\..\artifacts
OutputBaseFilename=On-The-Court-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin
CloseApplications=force
UninstallDisplayIcon={app}\{#MyAppExeName}
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
[InstallDelete]
Type: filesandordirs; Name: "{app}\resources"
[Files]
Source: "..\..\out\On The Court-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Play On The Court"; Flags: nowait postinstall skipifsilent
