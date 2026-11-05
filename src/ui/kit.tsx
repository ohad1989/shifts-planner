import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useI18n } from './i18n';
import { useTheme } from './theme';

// Small cross-platform building blocks shared by every screen.

type Tone = 'muted' | 'danger' | 'accent' | 'warn' | 'good';

export function T(props: {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  bold?: boolean;
  size?: number;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const theme = useTheme();
  const toneColor: Record<Tone, string> = {
    muted: theme.textMuted,
    danger: theme.danger,
    accent: theme.accent,
    warn: theme.warn,
    good: theme.good,
  };
  const color = props.tone ? toneColor[props.tone] : props.muted ? theme.textMuted : theme.text;
  return (
    <Text
      numberOfLines={props.numberOfLines}
      selectable={props.selectable}
      style={[
        { color, fontSize: props.size ?? (props.small ? 13 : 15), textAlign: 'auto' },
        props.bold && { fontWeight: '700' },
        props.style,
      ]}>
      {props.children}
    </Text>
  );
}

export function H(props: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <T bold size={props.size ?? 17} style={props.style}>
      {props.children}
    </T>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const v = props.variant ?? 'secondary';
  const colors = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    secondary: { bg: theme.surface, fg: theme.text, border: theme.borderStrong },
    danger: { bg: 'transparent', fg: theme.danger, border: theme.danger },
    link: { bg: 'transparent', fg: theme.accent, border: 'transparent' },
  }[v];
  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      hitSlop={v === 'link' ? 6 : 0}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        props.small && styles.buttonSmall,
        v === 'link' && styles.buttonLink,
        { backgroundColor: colors.bg, borderColor: colors.border },
        (pressed || props.disabled) && { opacity: props.disabled ? 0.45 : 0.7 },
      ]}>
      <Text style={[styles.buttonLabel, props.small && { fontSize: 14 }, { color: colors.fg }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function IconButton(props: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      disabled={props.disabled}
      hitSlop={8}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.icon,
        { borderColor: theme.border, backgroundColor: theme.surface },
        (pressed || props.disabled) && { opacity: 0.5 },
      ]}>
      <Text style={{ color: theme.text, fontSize: 18, lineHeight: 20 }}>{props.icon}</Text>
    </Pressable>
  );
}

export function Card(props: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, props.style]}>
      {props.children}
    </View>
  );
}

export function Row(props: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: props.gap ?? 8 },
        props.wrap && { flexWrap: 'wrap' },
        props.style,
      ]}>
      {props.children}
    </View>
  );
}

export function Spacer() {
  return <View style={{ flexGrow: 1 }} />;
}

export function Pill(props: { label: string; tone?: 'cover' | 'override' | 'warn' | 'accent' | 'muted' | 'open' }) {
  const theme = useTheme();
  const map = {
    cover: [theme.coverSoft, theme.cover],
    override: [theme.overrideSoft, theme.override],
    warn: [theme.warnSoft, theme.warn],
    accent: [theme.accentSoft, theme.accent],
    open: [theme.openSoft, theme.open],
    muted: [theme.background, theme.textMuted],
  } as const;
  const [bg, fg] = map[props.tone ?? 'muted'];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{props.label}</Text>
    </View>
  );
}

export function Chip(props: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={props.onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!props.on, disabled: !!props.disabled }}
      disabled={props.disabled || !props.onPress}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: props.on ? theme.accentSoft : theme.surface,
          borderColor: props.on ? theme.accent : theme.borderStrong,
        },
        (pressed || props.disabled) && { opacity: props.disabled ? 0.45 : 0.7 },
      ]}>
      <Text style={{ color: props.on ? theme.accent : theme.text, fontSize: 14, fontWeight: props.on ? '600' : '400' }}>
        {props.label}
      </Text>
      {props.onRemove && (
        <Pressable
          accessibilityLabel={props.removeLabel ?? 'Remove'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={props.onRemove}>
          <Text style={{ color: theme.textMuted, fontSize: 16, lineHeight: 16 }}>×</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/** A single choice from a short list, shown as chips (replaces <select>). */
export function Choice<V extends string | number>(props: {
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  return (
    <Row gap={6} wrap>
      {props.options.map(([v, label]) => (
        <Chip
          disabled={props.disabled}
          key={String(v)}
          label={label}
          on={v === props.value}
          onPress={() => props.onChange(v)}
        />
      ))}
    </Row>
  );
}

export function Field(props: { label: string; children: ReactNode; hint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.field, props.style]}>
      <T bold small muted>
        {props.label}
      </T>
      {props.children}
      {props.hint && (
        <T muted small>
          {props.hint}
        </T>
      )}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const theme = useTheme();
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      {...rest}
      style={[
        styles.input,
        {
          backgroundColor: theme.surface,
          borderColor: invalid ? theme.danger : theme.borderStrong,
          color: theme.text,
        },
        props.editable === false && { opacity: 0.5 },
        style,
      ]}
    />
  );
}

/** Time as HH:MM. Typing "930" or "9:30" becomes "09:30" on blur. */
export function TimeInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  accessibilityLabel?: string;
}) {
  const [text, setText] = useState(props.value);
  const [prev, setPrev] = useState(props.value);
  if (prev !== props.value) {
    setPrev(props.value);
    setText(props.value);
  }
  const commit = (raw: string) => {
    const v = normalizeTime(raw);
    if (v !== null) {
      setText(v);
      if (v !== props.value) props.onChange(v);
    } else if (raw.trim() === '' && props.allowEmpty) {
      if (props.value !== '') props.onChange('');
    } else {
      setText(props.value);
    }
  };
  return (
    <Input
      accessibilityLabel={props.accessibilityLabel}
      editable={!props.disabled}
      inputMode="numeric"
      maxLength={5}
      onBlur={() => commit(text)}
      onChangeText={(v) => {
        setText(v);
        if (/^\d\d:\d\d$/.test(v) && normalizeTime(v) !== null && v !== props.value) props.onChange(v);
      }}
      onSubmitEditing={() => commit(text)}
      placeholder={props.placeholder ?? 'HH:MM'}
      style={styles.time}
      value={text}
    />
  );
}

export function normalizeTime(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function Check(props: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.value, disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={() => props.onChange(!props.value)}
      style={({ pressed }) => [styles.check, (pressed || props.disabled) && { opacity: 0.5 }]}>
      <View
        style={[
          styles.box,
          {
            borderColor: props.value ? theme.accent : theme.borderStrong,
            backgroundColor: props.value ? theme.accent : theme.surface,
          },
        ]}>
        {props.value && <Text style={{ color: theme.onAccent, fontSize: 13, fontWeight: '800' }}>✓</Text>}
      </View>
      <T style={{ flexShrink: 1 }}>{props.label}</T>
    </Pressable>
  );
}

export function Banner(props: { tone: 'info' | 'error'; children: ReactNode; action?: ReactNode }) {
  const theme = useTheme();
  const bg = props.tone === 'error' ? theme.dangerSoft : theme.accentSoft;
  const fg = props.tone === 'error' ? theme.danger : theme.accent;
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={{ color: fg, flexShrink: 1, fontSize: 14 }}>{props.children}</Text>
      {props.action}
    </View>
  );
}

/** Expandable section (replaces <details>). */
export function Collapsible(props: {
  title: ReactNode;
  initiallyOpen?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(!!props.initiallyOpen);
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.collapsibleHead}>
        <Text style={{ color: theme.textMuted, width: 14 }}>{open ? '▾' : '▸'}</Text>
        {typeof props.title === 'string' ? <T bold>{props.title}</T> : props.title}
      </Pressable>
      {open && <View style={{ paddingStart: 20, paddingTop: 4 }}>{props.children}</View>}
    </View>
  );
}

/** Dialog: centred card on wide screens, bottom sheet on phones. */
export function Sheet(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const theme = useTheme();
  const { t, rtl } = useI18n();
  return (
    <Modal animationType="fade" onRequestClose={props.onClose} transparent visible>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable accessibilityLabel={t('Close')} onPress={props.onClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border, direction: rtl ? 'rtl' : 'ltr' },
            props.wide && { maxWidth: 760 },
          ]}>
          <Row style={[styles.sheetHead, { borderColor: theme.border }]}>
            <H style={{ flexShrink: 1 }}>{props.title}</H>
            <Spacer />
            <IconButton icon="×" label={t('Close')} onPress={props.onClose} />
          </Row>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {props.children}
          </ScrollView>
          {props.footer && (
            <Row gap={10} style={[styles.sheetFoot, { borderColor: theme.border }]} wrap>
              <Spacer />
              {props.footer}
            </Row>
          )}
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonSmall: { minHeight: 34, paddingHorizontal: 10 },
  buttonLink: { minHeight: 0, paddingHorizontal: 4, paddingVertical: 4 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  field: { gap: 6, minWidth: 0 },
  input: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  time: { width: 84, textAlign: 'center' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexWrap: 'wrap',
  },
  collapsibleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHead: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  sheetBody: { padding: 16, gap: 12 },
  sheetFoot: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
});
