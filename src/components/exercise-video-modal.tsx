import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ExerciseVideoModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  videoUrl?: string | null;
  instructions?: string | null;
};

function VideoContent({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (instance) => {
    instance.loop = true;
    instance.play();
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      nativeControls
    />
  );
}

export function ExerciseVideoModal({
  visible,
  onClose,
  title,
  videoUrl,
  instructions,
}: ExerciseVideoModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Fechar vídeo" hitSlop={8}>
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
          </View>

          {videoUrl ? (
            <VideoContent key={videoUrl} videoUrl={videoUrl} />
          ) : (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Vídeo indisponível para este exercício.
            </Text>
          )}

          {instructions ? (
            <Text style={[styles.instructions, { color: theme.textSecondary }]}>{instructions}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  empty: {
    fontSize: 14,
  },
  instructions: {
    fontSize: 13,
    lineHeight: 19,
  },
});
