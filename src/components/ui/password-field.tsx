import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { TextField, type TextFieldProps } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';

export function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'rightAccessory'>) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      rightAccessory={
        <Pressable
          onPress={() => setVisible((value) => !value)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}>
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>
      }
    />
  );
}
