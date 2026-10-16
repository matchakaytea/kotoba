import { useState } from 'react';
import type { CustomColors, Swatch, ThemeMode } from '../shared/palette';
import { cleanError } from './format';
import { useI18n } from './i18n/i18n';
import { swatchesFromPicture } from './theme';

type Props = {
  colors: CustomColors | undefined;
  swatches: Swatch[];
  picture: string | null;
  onPicture: (swatches: Swatch[], dataUrl: string) => void;
  onChange: (colors: CustomColors) => void;
};

export function CustomSkinPanel({
  colors,
  swatches,
  picture,
  onPicture,
  onChange,
}: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function choosePicture() {
    setError(null);
    try {
      const dataUrl = await window.kotoba.pickPicture();
      if (!dataUrl) return;
      setReading(true);
      const found = await swatchesFromPicture(dataUrl);
      if (found.length === 0) throw new Error(t('custom.error'));
      onPicture(found, dataUrl);
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="custom-skin">
      <div className="custom-skin-picture">
        {picture ? (
          <img src={picture} alt="" className="custom-skin-thumb" />
        ) : (
          <div
            className="custom-skin-thumb custom-skin-empty"
            aria-hidden="true"
          />
        )}
        <div>
          <button type="button" onClick={choosePicture} disabled={reading}>
            {t('custom.choose')}
          </button>
          <p className="field-hint">{t('custom.hint')}</p>
          {error && <p className="form-status error">{error}</p>}
        </div>
      </div>

      {colors && (
        <>
          <SwatchRow
            label={t('custom.background')}
            swatches={swatches}
            selected={colors.base}
            onSelect={(hex) => onChange({ ...colors, base: hex })}
          />
          <SwatchRow
            label={t('custom.accent')}
            swatches={swatches}
            selected={colors.accent}
            onSelect={(hex) => onChange({ ...colors, accent: hex })}
          />
          <div className="swatch-row">
            <span className="field-label">{t('custom.mode')}</span>
            <span className="segmented">
              {(['light', 'dark'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={colors.mode === mode ? 'active' : ''}
                  aria-pressed={colors.mode === mode}
                  onClick={() => onChange({ ...colors, mode })}
                >
                  {t(mode === 'light' ? 'custom.light' : 'custom.dark')}
                </button>
              ))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function SwatchRow({
  label,
  swatches,
  selected,
  onSelect,
}: {
  label: string;
  swatches: Swatch[];
  selected: string;
  onSelect: (hex: string) => void;
}) {
  const shown = swatches.some((swatch) => swatch.hex === selected)
    ? swatches
    : [{ hex: selected, share: 0 }, ...swatches];
  return (
    <div className="swatch-row">
      <span className="field-label">{label}</span>
      <span className="swatches">
        {shown.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            className={swatch.hex === selected ? 'swatch selected' : 'swatch'}
            style={{ background: swatch.hex }}
            aria-label={swatch.hex}
            aria-pressed={swatch.hex === selected}
            title={swatch.hex}
            onClick={() => onSelect(swatch.hex)}
          />
        ))}
      </span>
    </div>
  );
}
