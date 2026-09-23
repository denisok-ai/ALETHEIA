/** Витринные макеты для соцсетей: vitality, awaken, path — фото-подложка или векторный фон. */
import { existsSync } from 'fs';
import { Page, Text, View, Svg, Path, Circle, Rect, Ellipse } from '@react-pdf/renderer';
import { CertificateSiteBrandMark, ShowcaseLayoutBackground } from './brand-marks';
import { COLORS, SHOWCASE_CERT_BG, styles } from './theme';
import type { CertificateData } from './types';

export function VitalityBackgroundArt() {
  const W = 595;
  const H = 842;
  const spine = 'M 118 118 Q 104 260 118 420 Q 132 580 118 718';
  const points = [160, 240, 360, 480, 620];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#ffffff" />
        <Rect x={0} y={0} width={132} height={H} fill="#f4ead8" />
        <Rect x={0} y={0} width={132} height={H} fill="#c4a060" opacity={0.12} />
        <Path d="M 132 0 L 132 842" stroke="#c4a060" strokeWidth={1.4} opacity={0.55} />
        <Path d={spine} fill="none" stroke="#8a6a3f" strokeWidth={2.5} strokeLinecap="round" opacity={0.88} />
        <Path d={spine} fill="none" stroke="#2d5aa1" strokeWidth={0.9} strokeLinecap="round" opacity={0.22} />
        {points.map((cy, i) => (
          <Circle key={`pt-${i}`} cx={118} cy={cy} r={5} fill="#fffdf8" stroke="#a67c52" strokeWidth={0.6} />
        ))}
        <Path
          d="M 200 96 L 540 96 L 520 132 L 220 132 Z"
          fill="none"
          stroke="#c4a060"
          strokeWidth={0.95}
          opacity={0.5}
        />
        <Path
          d="M 360 720 Q 420 660 520 700"
          fill="none"
          stroke="#2d5aa1"
          strokeWidth={0.9}
          opacity={0.28}
        />
        <Circle cx={478} cy={198} r={74} fill="none" stroke="#c4a060" strokeWidth={0.45} opacity={0.22} />
        <Circle cx={478} cy={198} r={108} fill="none" stroke="#2d5aa1" strokeWidth={0.35} opacity={0.14} strokeDasharray="5 11" />
      </Svg>
    </View>
  );
}

export function CertificateVitality({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const photo = existsSync(SHOWCASE_CERT_BG.vitality);
  return (
    <Page size="A4" style={styles.page}>
      <ShowcaseLayoutBackground imageSrc={SHOWCASE_CERT_BG.vitality} vectorFallback={<VitalityBackgroundArt />} />
      <View
        style={{
          position: 'absolute',
          top: 44,
          left: photo ? 124 : 152,
          right: photo ? 28 : 40,
          bottom: 44,
          ...(photo
            ? {
                backgroundColor: 'rgba(255, 253, 248, 0.93)',
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 22,
                paddingRight: 14,
                borderRadius: 6,
                borderLeftWidth: 2,
                borderLeftColor: COLORS.certGoldLight,
              }
            : {}),
        }}
      >
        <CertificateSiteBrandMark marginBottom={6} alignItems="flex-start" width={158} height={48} />
        <View
          style={{
            marginTop: 22,
            paddingBottom: 10,
            borderBottomWidth: 2,
            borderBottomColor: COLORS.linkAccent,
            width: 140,
            opacity: 0.85,
          }}
        />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, color: COLORS.blogGold, marginTop: 22, fontWeight: 600 }}>
          СЕРТИФИКАТ
        </Text>
        <Text style={{ fontSize: 20, color: COLORS.primaryDark, marginTop: 10, fontWeight: 600 }}>Тело знает ответ</Text>
        <Text style={{ fontSize: 9.5, color: COLORS.muted, marginTop: 8, lineHeight: 1.45, maxWidth: 380 }}>
          Материалы для тех, кто хочет слышать тело глубже и работать с причиной, а не только со следствием.
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 28 }}>Удостоверяется, что</Text>
        <Text style={{ fontSize: 22, color: COLORS.dark, marginTop: 8, fontWeight: 600 }}>{data.userName}</Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 14 }}>успешно прошёл(ла) программу</Text>
        <Text style={{ fontSize: 15, color: COLORS.primary, marginTop: 6, fontWeight: 600 }}>{data.courseName}</Text>
        <View style={{ flexDirection: 'row', marginTop: 22, flexWrap: 'wrap' }}>
          {['Живое обучение', 'Практика с телом', 'Документ для портфолио'].map((t) => (
            <View
              key={t}
              style={{
                borderWidth: 1,
                borderColor: COLORS.certGold,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 20,
                marginRight: 8,
                marginBottom: 6,
                backgroundColor: COLORS.blogCream,
              }}
            >
              <Text style={{ fontSize: 8, color: COLORS.blogGoldDeep }}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4, maxWidth: 400 }}>
          Поделитесь достижением — отметьте @avaterra.pro · #мышечноетестирование · #Аватерра
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 0.5,
            borderTopColor: COLORS.certGold,
          }}
        >
          <Text style={{ fontSize: 9, color: COLORS.dark }}>№ {data.certNumber}</Text>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>{data.date}</Text>
        </View>
        {exp ? <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 6 }}>Действителен до {exp}</Text> : null}
        <Text style={{ fontSize: 9, color: COLORS.linkAccent, marginTop: 10, fontWeight: 600 }}>avaterra.pro</Text>
      </View>
    </Page>
  );
}

/** Витрина: пробуждение — тёплый свет, движение, эмоциональная ценность. */
export function AwakenBackgroundArt() {
  const W = 595;
  const H = 842;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#fffaf7" />
        <Ellipse cx={297} cy={138} rx={220} ry={118} fill="#fdecef" opacity={0.95} />
        <Ellipse cx={297} cy={128} rx={140} ry={72} fill="#fce4d6" opacity={0.55} />
        <Circle cx={297} cy={118} r={48} fill="#f6c4a8" opacity={0.35} />
        <Path
          d="M 0 280 Q 180 220 297 300 T 595 260"
          fill="none"
          stroke="#ce8fb0"
          strokeWidth={1.4}
          opacity={0.45}
        />
        <Path
          d="M 40 520 Q 200 420 297 520 Q 400 620 555 500"
          fill="none"
          stroke="#856b92"
          strokeWidth={1.1}
          opacity={0.35}
        />
        <Path
          d="M 320 400 Q 380 340 440 400 Q 400 480 340 460 Q 300 420 320 400"
          fill="none"
          stroke="#b4b1d8"
          strokeWidth={1.6}
          opacity={0.5}
        />
        <Path
          d="M 120 680 Q 297 600 475 680"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.9}
          opacity={0.4}
        />
        <Path
          d="M 48 88 Q 297 48 548 92"
          fill="none"
          stroke="#2d5aa1"
          strokeWidth={0.55}
          opacity={0.35}
        />
        <Rect x={32} y={32} width={W - 64} height={H - 64} fill="none" stroke="#a67c52" strokeWidth={1.5} opacity={0.55} />
        <Rect x={44} y={44} width={W - 88} height={H - 88} fill="none" stroke="#2d5aa1" strokeWidth={0.5} opacity={0.28} />
      </Svg>
    </View>
  );
}

export function CertificateAwaken({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const photo = existsSync(SHOWCASE_CERT_BG.awaken);
  return (
    <Page size="A4" style={styles.page}>
      <ShowcaseLayoutBackground imageSrc={SHOWCASE_CERT_BG.awaken} vectorFallback={<AwakenBackgroundArt />} />
      <View style={{ position: 'absolute', top: 56, left: 56, right: 56, bottom: 56, alignItems: 'center' }}>
        <View
          style={{
            alignItems: 'center',
            width: '100%',
            maxWidth: 460,
            height: '100%',
            ...(photo
              ? {
                  backgroundColor: 'rgba(255, 253, 248, 0.94)',
                  paddingVertical: 26,
                  paddingHorizontal: 28,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(166, 124, 82, 0.35)',
                }
              : {}),
          }}
        >
        <CertificateSiteBrandMark marginBottom={8} width={168} height={52} />
        <Text style={{ fontSize: 12, letterSpacing: 2, color: COLORS.blogGold, marginTop: 28, fontWeight: 600 }}>СЕРТИФИКАТ</Text>
        <Text style={{ fontSize: 22, color: COLORS.primaryDark, marginTop: 10, fontWeight: 600, textAlign: 'center' }}>
          Пробуждение через тело
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 12, textAlign: 'center', maxWidth: 420, lineHeight: 1.5 }}>
          «Когда тело просыпается, меняется и жизнь. Этот сертификат — память о живом опыте, который остаётся с
          вами.»
        </Text>
        <View style={{ height: 2, width: 168, backgroundColor: COLORS.linkAccent, marginTop: 22, opacity: 0.45 }} />
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 26 }}>Настоящим удостоверяется, что</Text>
        <Text style={{ fontSize: 21, color: COLORS.dark, marginTop: 8, fontWeight: 600, textAlign: 'center' }}>{data.userName}</Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 14 }}>прошёл(ла) программу</Text>
        <Text style={{ fontSize: 15, color: COLORS.primary, marginTop: 6, fontWeight: 600, textAlign: 'center' }}>{data.courseName}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: COLORS.muted, textAlign: 'center', lineHeight: 1.45, maxWidth: 440 }}>
          Сохраните PDF — он отлично смотрится в сторис и на печати. Отметьте школу: @avaterra.pro · #Пробуждение
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>№ {data.certNumber}</Text>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>{data.date}</Text>
        </View>
        {exp ? <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 8 }}>Действителен до {exp}</Text> : null}
        <Text style={{ fontSize: 9, color: COLORS.linkAccent, marginTop: 12, fontWeight: 600 }}>avaterra.pro</Text>
        </View>
      </View>
    </Page>
  );
}

/** Витрина: первый шаг — доверие, вход в сообщество практиков. */
export function PathBackgroundArt() {
  const W = 595;
  const H = 842;
  const stones = [0, 1, 2, 3, 4].map((i) => {
    const x = 120 + i * 88;
    const y = 620 - i * 36 + Math.sin(i) * 8;
    return <Circle key={`st-${i}`} cx={x} cy={y} r={14} fill="#faf9fc" stroke="#a67c52" strokeWidth={1.2} opacity={0.85} />;
  });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#faf9fc" />
        <Path d="M 180 120 Q 297 40 415 120" fill="none" stroke="#c4a060" strokeWidth={1.8} opacity={0.42} />
        <Path d="M 200 120 L 395 120" stroke="#2d5aa1" strokeWidth={0.65} opacity={0.35} />
        <Circle cx={297} cy={118} r={6} fill="#c4a060" opacity={0.55} />
        <Path
          d="M 0 760 Q 150 680 297 720 T 595 740 L 595 842 L 0 842 Z"
          fill="#ebe6f8"
          opacity={0.55}
        />
        {stones}
        <Path
          d="M 134 616 Q 220 560 297 600 T 460 640"
          fill="none"
          stroke="#856b92"
          strokeWidth={0.8}
          opacity={0.35}
          strokeDasharray="4 8"
        />
        <Rect x={36} y={36} width={W - 72} height={H - 72} fill="none" stroke="#c4a060" strokeWidth={1} opacity={0.45} />
      </Svg>
    </View>
  );
}

export function CertificatePath({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const photo = existsSync(SHOWCASE_CERT_BG.path);
  return (
    <Page size="A4" style={styles.page}>
      <ShowcaseLayoutBackground imageSrc={SHOWCASE_CERT_BG.path} vectorFallback={<PathBackgroundArt />} />
      <View
        style={{
          position: 'absolute',
          top: 48,
          left: photo ? 40 : 52,
          right: photo ? 40 : 52,
          bottom: 200,
          ...(photo
            ? {
                backgroundColor: 'rgba(250, 249, 252, 0.94)',
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 18,
                paddingRight: 18,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(133, 107, 146, 0.25)',
              }
            : {}),
        }}
      >
        <CertificateSiteBrandMark marginBottom={4} alignItems="flex-start" width={156} height={48} />
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 24,
            backgroundColor: COLORS.blogCream,
            borderWidth: 1,
            borderColor: COLORS.certGold,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 8, color: COLORS.blogGoldDeep, fontWeight: 600, letterSpacing: 1.2 }}>СТАРТ ПРАКТИКИ</Text>
        </View>
        <Text style={{ fontSize: 20, color: COLORS.primaryDark, marginTop: 18, fontWeight: 600 }}>Первый шаг сделан</Text>
        <Text style={{ fontSize: 9.5, color: COLORS.muted, marginTop: 10, lineHeight: 1.45, maxWidth: 400 }}>
          Этот сертификат — не «галочка», а вход в сообщество людей, которые разговаривают с телом на языке
          уважения и точности.
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 36 }}>Удостоверяется, что</Text>
        <Text style={{ fontSize: 21, color: COLORS.dark, marginTop: 8, fontWeight: 600 }}>{data.userName}</Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 14 }}>освоил(а) вводную программу</Text>
        <Text style={{ fontSize: 15, color: COLORS.primaryDark, marginTop: 6, fontWeight: 600 }}>{data.courseName}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4 }}>
          Расскажите друзьям, как начался ваш путь: @avaterra.pro · #Аватерра · #Мышечноетестирование
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>№ {data.certNumber}</Text>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>{data.date}</Text>
        </View>
        {exp ? <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 6 }}>Действителен до {exp}</Text> : null}
      </View>
      <View style={{ position: 'absolute', bottom: 36, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: COLORS.linkAccent, fontWeight: 600 }}>avaterra.pro</Text>
      </View>
    </Page>
  );
}
