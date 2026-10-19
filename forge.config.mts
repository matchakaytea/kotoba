import path from 'node:path';
import { MakerBase, type MakerOptions } from '@electron-forge/maker-base';
import type { ForgeConfig, ForgePlatform } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { Arch, build, Platform } from 'electron-builder';

/**
 * Builds a Windows installer with electron-builder's NSIS target from the app
 * Forge has already packaged. Unlike Squirrel, it lets you pick the folder.
 */
class MakerNsis extends MakerBase<Record<string, never>> {
  name = 'nsis';
  defaultPlatforms: ForgePlatform[] = ['win32'];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'win32';
  }

  async make({ dir, makeDir, targetArch }: MakerOptions): Promise<string[]> {
    const files = await build({
      prepackaged: dir,
      targets: Platform.WINDOWS.createTarget(
        'nsis',
        Arch[targetArch as keyof typeof Arch],
      ),
      config: {
        appId: 'com.matchakaytea.kotoba',
        directories: { output: path.join(makeDir, 'nsis', targetArch) },
        win: { icon: 'assets/icon.ico' },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          installerIcon: 'assets/icon.ico',
          uninstallerIcon: 'assets/icon.ico',
          shortcutName: 'kotoba',
          artifactName: 'kotoba-${version} Setup.${ext}',
        },
      },
    });
    return files.filter((file) => file.endsWith('.exe'));
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Each platform adds its own extension: assets/icon.ico on Windows.
    icon: 'assets/icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerNsis(),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
