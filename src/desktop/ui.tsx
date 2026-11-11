// Small building blocks for the desktop screens: buttons with hover states,
// chips, a segmented control, a switch, popovers, dialogs, breadcrumbs and the
// standard scrolling page. Everything here is web-only (react-native-web),
// imported only from *.web.tsx routes.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  View, Text, Pressable, ScrollView, StyleSheet, StyleProp, ViewStyle, TextStyle,
  ScrollViewProps, ActivityIndicator,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { SANS, SERIF, tints, web, alpha, PAGE_W } from './theme';

type PState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/** Sets the native tooltip (title attribute) on the rendered DOM node. */
export function useTooltip(tip?: string) {
  return (el: any) => {
    if (el && tip !== undefined && typeof el === 'object' && 'title' in el) el.title = tip;
  };
}

// ─── Buttons ──────────────────────────────────────────────────────────────

export function Btn({
  label, onPress, icon, kind = 'secondary', size = 'md', disabled, tip, style, textStyle, busy,
}: {
  label: string;
  onPress?: () => void;
  icon?: string;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  tip?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  const pad = size === 'sm' ? { paddingHorizontal: 10, height: 30 } : size === 'lg' ? { paddingHorizontal: 20, height: 42 } : { paddingHorizontal: 14, height: 36 };
  const fs = size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5;
  return (
    <Pressable
      ref={useTooltip(tip)}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={tip ?? label}
      style={(s: PState) => {
        const h = s.hovered && !disabled;
        let bg: string = 'transparent';
        let border: string = 'transparent';
        if (kind === 'primary') { bg = h ? colors.primaryDark : colors.primary; border = bg; }
        else if (kind === 'secondary') { bg = h ? t.hover : colors.surface; border = colors.border; }
        else if (kind === 'danger') { bg = h ? alpha(colors.error, 0.9) : colors.error; border = bg; }
        else if (kind === 'dangerGhost') { bg = h ? alpha(colors.error, 0.1) : 'transparent'; border = alpha(colors.error, 0.5); }
        else if (h) bg = t.hover;
        return [
          styles.btn, pad,
          { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : s.pressed ? 0.85 : 1 },
          web({ cursor: disabled ? 'default' : 'pointer', transition: 'background-color 120ms, border-color 120ms' }),
          style,
        ];
      }}
    >
      {busy ? <ActivityIndicator size="small" color={kind === 'primary' || kind === 'danger' ? '#FFF' : colors.primary} /> : null}
      {icon && !busy ? (
        <Text style={[styles.btnIcon, { fontSize: fs + 2, color: kind === 'primary' || kind === 'danger' ? '#FFF' : kind === 'dangerGhost' ? colors.error : colors.primary }]}>{icon}</Text>
      ) : null}
      <Text
        style={[
          styles.btnText,
          { fontSize: fs, color: kind === 'primary' || kind === 'danger' ? '#FFF' : kind === 'dangerGhost' ? colors.error : colors.text },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Square icon button with a tooltip. */
export function IconBtn({
  icon, onPress, tip, active, size = 36, badge, color, disabled, style,
}: {
  icon: React.ReactNode; onPress?: () => void; tip: string; active?: boolean; size?: number;
  badge?: number; color?: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  return (
    <Pressable
      ref={useTooltip(tip)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={tip}
      style={(s: PState) => [
        styles.iconBtn,
        {
          width: size, height: size, borderRadius: 8,
          backgroundColor: active ? t.selected : s.hovered ? t.hover : 'transparent',
          opacity: disabled ? 0.35 : s.pressed ? 0.8 : 1,
        },
        web({ cursor: disabled ? 'default' : 'pointer', transition: 'background-color 120ms' }),
        style,
      ]}
    >
      {typeof icon === 'string'
        ? <Text style={[styles.iconGlyph, { color: color ?? (active ? colors.primary : colors.textSecondary), fontSize: size * 0.48 }]}>{icon}</Text>
        : icon}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Pressable row/card with a hover background. */
export function HoverRow({
  onPress, children, style, hoverBg, tip, disabled, onHoverChange, accessibilityRole = 'button',
}: {
  onPress?: () => void; children: React.ReactNode | ((hovered: boolean) => React.ReactNode);
  style?: StyleProp<ViewStyle> | ((hovered: boolean) => StyleProp<ViewStyle>); hoverBg?: string; tip?: string; disabled?: boolean;
  onHoverChange?: (h: boolean) => void; accessibilityRole?: any;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      ref={useTooltip(tip)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      onHoverIn={() => { setHovered(true); onHoverChange?.(true); }}
      onHoverOut={() => { setHovered(false); onHoverChange?.(false); }}
      style={(s: PState) => [
        typeof style === 'function' ? style(hovered) : style,
        hovered && !disabled ? { backgroundColor: hoverBg ?? t.hover } : null,
        { opacity: s.pressed ? 0.85 : 1 },
        web({ cursor: onPress && !disabled ? 'pointer' : 'default', transition: 'background-color 120ms, box-shadow 160ms, transform 160ms' }),
      ]}
    >
      {typeof children === 'function' ? children(hovered) : children}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, color, count, small }: {
  label: string; on?: boolean; onPress?: () => void; color?: string; count?: number; small?: boolean;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  const c = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={(s: PState) => [
        styles.chip,
        small && { height: 26, paddingHorizontal: 10 },
        {
          backgroundColor: on ? c : s.hovered ? t.hover : 'transparent',
          borderColor: on ? c : color ? alpha(color, 0.6) : colors.border,
        },
        web({ cursor: 'pointer', transition: 'background-color 120ms' }),
      ]}
    >
      <Text style={[styles.chipText, small && { fontSize: 12 }, { color: on ? '#FFF' : color ?? colors.textSecondary }]} numberOfLines={1}>
        {label}
        {count !== undefined ? <Text style={{ opacity: 0.7 }}>{`  ${count}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange, style }: {
  value: T; options: { key: T; label: string }[]; onChange: (k: T) => void; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  return (
    <View style={[styles.seg, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={(s: PState) => [
              styles.segBtn,
              { backgroundColor: on ? colors.card : s.hovered ? t.hover : 'transparent' },
              on && web({ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }),
              web({ cursor: 'pointer', transition: 'background-color 120ms' }),
            ]}
          >
            <Text style={[styles.segText, { color: on ? colors.primary : colors.textSecondary }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={[
        styles.toggle,
        { backgroundColor: value ? colors.primary : colors.border },
        web({ cursor: 'pointer', transition: 'background-color 140ms' }),
      ]}
    >
      <View style={[styles.knob, { transform: [{ translateX: value ? 18 : 0 }] }, web({ transition: 'transform 140ms' })]} />
    </Pressable>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────

function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function useEsc(active: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); ref.current(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [active]);
}

/**
 * Non-modal dropdown hung under `anchor` (a DOM node). Clicking outside or Esc
 * closes it.
 */
export function Popover({ anchor, open, onClose, children, width = 280, align = 'right' }: {
  anchor: any; open: boolean; onClose: () => void; children: React.ReactNode; width?: number; align?: 'left' | 'right';
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  const card = useRef<any>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEsc(open, onClose);

  useLayoutEffect(() => {
    if (!open || !anchor?.getBoundingClientRect) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const left = align === 'right' ? r.right - width : r.left;
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchor, width, align]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const n = e.target as Node;
      if (card.current?.contains?.(n) || anchor?.contains?.(n)) return;
      onClose();
    };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open, anchor, onClose]);

  if (!open || !pos) return null;
  return (
    <Portal>
      <View
        ref={card}
        dataSet={{ vbPop: '1' }}
        style={[
          styles.popover,
          { top: pos.top, left: pos.left, width, backgroundColor: colors.surface, borderColor: colors.border },
          web({ position: 'fixed', boxShadow: t.shadowLg, maxHeight: `calc(100vh - ${pos.top + 16}px)`, overflowY: 'auto' }),
        ] as any}
      >
        {children}
      </View>
    </Portal>
  );
}

/** Centered modal dialog with a dimmed backdrop. */
export function Dialog({ open, onClose, title, children, width = 520, footer }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; width?: number; footer?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const t = tints(colors);
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <View style={[StyleSheet.absoluteFill, styles.dialogWrap, web({ position: 'fixed', zIndex: 1000 })] as any}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} onPress={onClose} accessibilityLabel="Close" />
        <View
          dataSet={{ vbPop: '1' }}
          accessibilityRole={'dialog' as any}
          style={[styles.dialog, { width, backgroundColor: colors.surface, borderColor: colors.border }, web({ boxShadow: t.shadowLg, maxHeight: '86vh' })] as any}
        >
          {title ? (
            <View style={[styles.dialogHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.dialogTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
              <IconBtn icon="✕" tip="Close (Esc)" onPress={onClose} size={30} />
            </View>
          ) : null}
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.dialogBody}>{children}</ScrollView>
          {footer ? <View style={[styles.dialogFoot, { borderTopColor: colors.border }]}>{footer}</View> : null}
        </View>
      </View>
    </Portal>
  );
}

/** Imperative confirm dialog (Alert.alert replacement for desktop pages). */
export function ConfirmDialog({ open, title, message, confirmLabel, destructive, onConfirm, onClose }: {
  open: boolean; title: string; message?: string; confirmLabel: string; destructive?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      footer={
        <>
          <Btn label="Cancel" onPress={onClose} />
          <Btn label={confirmLabel} kind={destructive ? 'danger' : 'primary'} onPress={() => { onClose(); onConfirm(); }} />
        </>
      }
    >
      {message ? <Text style={[styles.body, { color: colors.textSecondary }]}>{message}</Text> : null}
    </Dialog>
  );
}

// ─── Page furniture ───────────────────────────────────────────────────────

export type Crumb = { label: string; href?: Href };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.crumbs} accessibilityRole={'navigation' as any}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 ? <Text style={[styles.crumbSep, { color: colors.textMuted }]}>›</Text> : null}
            {c.href && !last ? (
              <Pressable onPress={() => router.push(c.href!)} style={web({ cursor: 'pointer' })} accessibilityRole="link">
                {(s: PState) => (
                  <Text style={[styles.crumb, { color: colors.primary }, s.hovered && { textDecorationLine: 'underline' }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                )}
              </Pressable>
            ) : (
              <Text style={[styles.crumb, { color: last ? colors.textSecondary : colors.textMuted }]} numberOfLines={1}>{c.label}</Text>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** Vertical scroller with the page's content centered at `maxWidth`. */
export const Page = React.forwardRef<ScrollView, ScrollViewProps & { maxWidth?: number; children: React.ReactNode; padTop?: number }>(
  function Page({ maxWidth = PAGE_W, children, padTop = 28, contentContainerStyle, ...rest }, ref) {
    const { colors } = useTheme();
    return (
      <ScrollView
        ref={ref}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[{ paddingTop: padTop, paddingBottom: 64, paddingHorizontal: 32, alignItems: 'center' }, contentContainerStyle]}
        scrollEventThrottle={64}
        {...rest}
      >
        <View style={{ width: '100%', maxWidth }} dataSet={{ vbPage: '1' }}>{children}</View>
      </ScrollView>
    );
  },
);

export function PageTitle({ title, eyebrow, subtitle, right }: { title: string; eyebrow?: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.pageTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.pageSub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.titleRight}>{right}</View> : null}
    </View>
  );
}

export function SectionHeader({ title, right, count }: { title: string; right?: React.ReactNode; count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
      {count !== undefined ? <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{count}</Text> : null}
      <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Kbd({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.kbd, { color: colors.textMuted, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, borderWidth: 1 },
  btnText: { fontFamily: SANS, fontWeight: '600' },
  btnIcon: { fontFamily: SANS, fontWeight: '600' },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontFamily: SANS, fontWeight: '600', textAlign: 'center' },
  badge: { position: 'absolute', top: 1, right: 0, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 9.5, fontWeight: '800', fontFamily: SANS },
  chip: { height: 30, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: SANS, fontSize: 13, fontWeight: '600' },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 14, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: SANS, fontSize: 13, fontWeight: '600' },
  toggle: { width: 40, height: 22, borderRadius: 11, padding: 2, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' },
  popover: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 8, zIndex: 1000 },
  dialogWrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', maxWidth: '100%' },
  dialogHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dialogTitle: { flex: 1, fontFamily: SANS, fontSize: 16, fontWeight: '700' },
  dialogBody: { padding: 20, gap: 12 },
  dialogFoot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  body: { fontFamily: SANS, fontSize: 14, lineHeight: 21 },
  crumbs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, minHeight: 20 },
  crumb: { fontFamily: SANS, fontSize: 13, fontWeight: '500' },
  crumbSep: { fontFamily: SANS, fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 20 },
  titleRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontFamily: SANS, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 },
  pageTitle: { fontFamily: SERIF, fontSize: 32, fontWeight: '600', letterSpacing: -0.3 },
  pageSub: { fontFamily: SANS, fontSize: 14.5, marginTop: 6, lineHeight: 21 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28, marginBottom: 14 },
  sectionTitle: { fontFamily: SANS, fontSize: 12, fontWeight: '700', letterSpacing: 1.3 },
  sectionCount: { fontFamily: SANS, fontSize: 12, fontWeight: '600' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', paddingVertical: 72, gap: 10 },
  emptyIcon: { fontSize: 44, marginBottom: 6 },
  emptyTitle: { fontFamily: SANS, fontSize: 18, fontWeight: '700' },
  emptyBody: { fontFamily: SANS, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 440 },
  kbd: { fontFamily: SANS, fontSize: 11, fontWeight: '600', borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
});
