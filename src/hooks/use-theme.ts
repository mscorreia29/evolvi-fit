import { Colors } from '@/constants/theme';

/**
 * Evolvi Fit usa uma identidade escura fixa (dark-first), independente do
 * tema do sistema. Isso mantém a experiência consistente com a marca.
 */
export function useTheme() {
  return Colors.dark;
}
