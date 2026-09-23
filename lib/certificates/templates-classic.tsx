/** Классические макеты: heritage (он же default), prestige, minimal, elegant — с их фоном и орнаментами. */
import { Page, Text, View, Image, Svg, Path, Line, Circle, Rect } from '@react-pdf/renderer';
import { CertificateSiteBrandMark, HeritageSealCheckGraphic, certificateBrandLogoAbsPath } from './brand-marks';
import { COLORS, styles, taglineFor } from './theme';
import type { CertificateData } from './types';

export function HeritageBackgroundArt() {
  const W = 595;
  const H = 842;
  const diagonals = Array.from({ length: 20 }, (_, i) => {
    const x0 = -48 + i * 42;
    return (
      <Line
        key={`d-${i}`}
        x1={x0}
        y1={0}
        x2={x0 + 130}
        y2={H}
        stroke="#ebe6f8"
        strokeWidth={0.35}
      />
    );
  });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#ffffff" />
        {diagonals}
        <Path d="M 0 92 A 92 92 0 0 1 92 0" fill="none" stroke="#ce8fb0" strokeWidth={1.1} opacity={0.42} />
        <Path d="M 503 0 A 92 92 0 0 1 595 92" fill="none" stroke="#856b92" strokeWidth={1.1} opacity={0.42} />
        <Path d="M 0 750 A 92 92 0 0 0 92 842" fill="none" stroke="#b4b1d8" strokeWidth={1.1} opacity={0.42} />
        <Path d="M 595 750 A 92 92 0 0 1 503 842" fill="none" stroke="#ce8fb0" strokeWidth={1.1} opacity={0.42} />
        <Circle cx={W / 2} cy={H / 2} r={195} fill="none" stroke="#856b92" strokeWidth={0.45} opacity={0.12} />
        <Circle
          cx={W / 2}
          cy={H / 2}
          r={235}
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.4}
          strokeDasharray="5 10"
          opacity={0.22}
        />
        <Path
          d="M 520 120 Q 480 80 440 120"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.55}
          opacity={0.35}
        />
        <Path
          d="M 75 720 Q 115 760 155 720"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.55}
          opacity={0.32}
        />
        <Path
          d="M 400 0 L 595 0 L 595 140"
          fill="none"
          stroke="#856b92"
          strokeWidth={1.4}
          opacity={0.35}
        />
        <Path
          d="M 0 720 L 0 842 L 160 842"
          fill="none"
          stroke="#ce8fb0"
          strokeWidth={1.2}
          opacity={0.3}
        />
      </Svg>
    </View>
  );
}

/** Премиум: белый лист + тонкие диагонали и кольцо. */
export function PrestigeBackgroundArt() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox="0 0 595 842">
        <Rect width="595" height="842" fill="#ffffff" />
        <Line x1="0" y1="0" x2="595" y2="842" stroke="#e8e0f0" strokeWidth={0.3} />
        <Line x1="595" y1="0" x2="0" y2="842" stroke="#e8e0f0" strokeWidth={0.3} />
        <Circle cx="297.5" cy="410" r="260" fill="none" stroke="#856b92" strokeWidth={0.35} opacity={0.09} />
        <Circle cx="297.5" cy="410" r="198" fill="none" stroke="#a67c52" strokeWidth={0.4} opacity={0.14} strokeDasharray="4 14" />
      </Svg>
    </View>
  );
}

/** Минимализм: редкая точечная сетка вместо заливки. */
export function MinimalBackgroundArt() {
  const dots = Array.from({ length: 120 }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    return (
      <Circle
        key={`dot-${i}`}
        cx={48 + col * 56}
        cy={64 + row * 58}
        r={1}
        fill="none"
        stroke="#a67c52"
        strokeWidth={0.4}
        opacity={0.28}
      />
    );
  });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox="0 0 595 842">
        <Rect width="595" height="842" fill="#ffffff" />
        {dots}
      </Svg>
    </View>
  );
}

/** Элегант: лёгкие волнообразные линии. */
export function ElegantBackgroundArt() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox="0 0 595 842">
        <Rect width="595" height="842" fill="#ffffff" />
        <Path
          d="M 0 200 Q 148 160 297 200 T 595 200"
          fill="none"
          stroke="#ce8fb0"
          strokeWidth={0.45}
          opacity={0.28}
        />
        <Path
          d="M 0 480 Q 148 520 297 480 T 595 480"
          fill="none"
          stroke="#856b92"
          strokeWidth={0.45}
          opacity={0.22}
        />
        <Path
          d="M 0 650 Q 200 610 297 650 T 595 650"
          fill="none"
          stroke="#b4b1d8"
          strokeWidth={0.35}
          opacity={0.2}
        />
      </Svg>
    </View>
  );
}

export function HeritageOrnamentBar() {
  return (
    <View style={styles.heritageFlourishWrap}>
      <Svg width={200} height={30} viewBox="0 0 200 30">
        <Line x1="0" y1="15" x2="72" y2="15" stroke="#a67c52" strokeWidth={0.9} />
        <Path
          d="M 100 8.5 L 105.5 15 L 100 21.5 L 94.5 15 Z"
          fill="none"
          stroke="#a67c52"
          strokeWidth={1}
        />
        <Line x1="128" y1="15" x2="200" y2="15" stroke="#a67c52" strokeWidth={0.9} />
        <Path
          d="M 68 15 Q 84 5 100 15 Q 116 5 132 15"
          stroke="#856b92"
          strokeWidth={0.75}
          fill="none"
          opacity={0.55}
        />
      </Svg>
    </View>
  );
}

export function HeritageOrnamentSmall() {
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Svg width={120} height={16} viewBox="0 0 120 16">
        <Line x1="0" y1="8" x2="44" y2="8" stroke="#b4b1d8" strokeWidth={0.75} />
        <Circle cx="60" cy="8" r="3" stroke="#ce8fb0" strokeWidth={1} fill="#ffffff" />
        <Line x1="76" y1="8" x2="120" y2="8" stroke="#b4b1d8" strokeWidth={0.75} />
      </Svg>
    </View>
  );
}

export function HeritageSideDots({ side }: { side: 'left' | 'right' }) {
  const n = 12;
  return (
    <View style={side === 'left' ? styles.heritageSideDotsLeft : styles.heritageSideDotsRight}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={[styles.heritageDot, i === n - 1 ? { marginBottom: 0 } : {}]} />
      ))}
    </View>
  );
}

export function PrestigeDiagonalPattern() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.055 }}>
      <Svg width={595} height={540} viewBox="0 0 595 540">
        {[0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448].map((y) => (
          <Line key={y} x1={0} y1={y} x2={595} y2={y + 48} stroke="#a67c52" strokeWidth={0.35} />
        ))}
      </Svg>
    </View>
  );
}

export function ElegantFlourishHeader() {
  return (
    <View style={{ alignItems: 'center', marginBottom: 12 }}>
      <Svg width={220} height={36} viewBox="0 0 220 36">
        <Path
          d="M 0 18 Q 55 6 110 18 T 220 18"
          stroke="#ce8fb0"
          strokeWidth={1}
          fill="none"
          opacity={0.65}
        />
        <Path
          d="M 110 10 L 114 18 L 110 26 L 106 18 Z"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.95}
          opacity={0.75}
        />
      </Svg>
    </View>
  );
}

export function ElegantFlourishFooter() {
  return (
    <View style={{ alignItems: 'center', marginTop: 14 }}>
      <Svg width={180} height={20} viewBox="0 0 180 20">
        <Line x1="0" y1="10" x2="180" y2="10" stroke="#b4b1d8" strokeWidth={0.6} />
        {[30, 60, 90, 120, 150].map((x) => (
          <Circle key={x} cx={x} cy={10} r={1.5} fill="#ce8fb0" fillOpacity={0.5} />
        ))}
      </Svg>
    </View>
  );
}

export function CertificateHeritage({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.heritagePage}>
      <HeritageBackgroundArt />
      <View style={styles.heritageOuterFrame} />
      <View style={styles.heritageMidFrame} />
      <View style={styles.heritageInnerFrame} />
      <View style={styles.heritageCornerTL} />
      <View style={styles.heritageCornerTR} />
      <View style={styles.heritageCornerBL} />
      <View style={styles.heritageCornerBR} />
      <HeritageSideDots side="left" />
      <HeritageSideDots side="right" />
      <View style={styles.heritageBody}>
        <CertificateSiteBrandMark marginBottom={10} />
        <Text style={styles.heritageTagline}>{taglineFor(data)}</Text>
        <HeritageOrnamentBar />
        <Text style={styles.heritageMicroLine}>Официальный документ об образовании · Школа «AVATERRA»</Text>
        <Text style={styles.heritageCertLabel}>СЕРТИФИКАТ</Text>
        <Text style={styles.heritageTitle}>О прохождении обучения</Text>
        <View style={styles.heritageHairline} />
        <Text style={styles.heritageLead}>Настоящим удостоверяется, что</Text>
        <Text style={styles.heritageName}>{data.userName}</Text>
        <Text style={styles.heritageCourseHint}>успешно освоил(а) образовательную программу</Text>
        <Text style={styles.heritageCourse}>{data.courseName}</Text>
        <HeritageOrnamentSmall />
        <View style={styles.heritageAwardBlock}>
          <View style={styles.heritageSealOuter}>
            <View style={styles.heritageSealInner}>
              <HeritageSealCheckGraphic />
            </View>
          </View>
          <View style={styles.heritageSealCaption}>
            <Text style={styles.heritageSealCapTitle}>УЧАСТИЕ ПОДТВЕРЖДЕНО</Text>
            <Text style={styles.heritageSealCapSub}>Регистрация в базе школы по номеру сертификата</Text>
          </View>
        </View>
        <View style={styles.heritageGrow} />
        <View style={styles.heritageSignaturesRow}>
          <View style={styles.heritageSigCol}>
            <Text style={styles.heritageSigLine}>________________________</Text>
            <Text style={styles.heritageSigCap}>Руководитель программы</Text>
          </View>
          <View style={styles.heritageSigCol}>
            <Text style={styles.heritageSigLine}>________________________</Text>
            <Text style={styles.heritageSigCap}>Печать / электронная отметка</Text>
          </View>
        </View>
        <View style={styles.heritageFooter}>
          <Text style={styles.heritageMeta}>Регистрационный № {data.certNumber}</Text>
          <Text style={styles.heritageMeta}>Дата выдачи: {data.date}</Text>
        </View>
        <Text style={styles.heritageFinePrint}>
          Документ подтверждает факт прохождения указанной программы. Подлинность можно проверить по номеру на
          сайте школы.
        </Text>
        {exp ? <Text style={styles.heritageExpiry}>Действителен до {exp}</Text> : null}
        <Text style={styles.heritageSite}>avaterra.pro · школа мышечного тестирования</Text>
      </View>
    </Page>
  );
}

export function CertificatePrestige({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const brandLogo = certificateBrandLogoAbsPath();
  return (
    <Page size="A4" style={styles.page}>
      <PrestigeBackgroundArt />
      <View style={styles.prestigeHeader}>
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          {brandLogo ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
              <Image src={brandLogo} style={styles.prestigeHeaderLogo} />
            </>
          ) : (
            <Text style={styles.prestigeHeaderWordmark}>АВАТЕРРА</Text>
          )}
        </View>
        <View style={styles.prestigeHeaderRight}>
          <Text style={styles.prestigeHeaderTitle}>СЕРТИФИКАТ</Text>
          <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, letterSpacing: 1.2, textAlign: 'right' }}>
            О ПРОХОЖДЕНИИ ОБУЧЕНИЯ
          </Text>
        </View>
      </View>
      <View style={styles.prestigeGoldBar} />
      <View style={{ flex: 1, position: 'relative' }}>
        <PrestigeDiagonalPattern />
        <View style={styles.prestigeSideAccentLeft} />
        <View style={styles.prestigeSideAccentRight} />
        <View style={styles.prestigeBodyWrap}>
          <View style={styles.prestigeInnerAccent} />
          <View style={styles.prestigeDecorTop}>
            <View style={styles.prestigeDecorInner} />
          </View>
          <Text style={styles.prestigeLead}>Удостоверение</Text>
          <Text style={styles.prestigeName}>{data.userName}</Text>
          <Text style={styles.prestigeCourseLine}>прошёл(ла) программу</Text>
          <Text style={styles.prestigeCourse}>{data.courseName}</Text>
          <Text style={styles.prestigeQuote}>
            «Тело отвечает честно — когда мы знаем, как задать вопрос.»
          </Text>
          <View style={styles.prestigeBadgeRow}>
            <View style={styles.prestigeBadge}>
              <Text style={styles.prestigeBadgeText}>Практикум</Text>
            </View>
            <View style={styles.prestigeBadge}>
              <Text style={styles.prestigeBadgeText}>Живые сессии</Text>
            </View>
            <View style={styles.prestigeBadge}>
              <Text style={styles.prestigeBadgeText}>Кураторы</Text>
            </View>
          </View>
          <View style={styles.prestigeGrow} />
          <View style={styles.prestigeFooter}>
            <Text style={styles.prestigeMeta}>№ {data.certNumber}</Text>
            <Text style={styles.prestigeMeta}>{data.date}</Text>
          </View>
          {exp ? <Text style={styles.prestigeExpiry}>Действителен до {exp}</Text> : null}
        </View>
      </View>
      <View style={styles.prestigeBottomBar}>
        <Text style={styles.prestigeSite}>{taglineFor(data)} · avaterra.pro</Text>
      </View>
    </Page>
  );
}

export function CertificateMinimal({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.pageCream}>
      <MinimalBackgroundArt />
      <View style={styles.minimalOuterGlow} />
      <View style={styles.minimalCornerTL} />
      <View style={styles.minimalCornerBR} />
      <View style={styles.minimalWrap}>
        <CertificateSiteBrandMark marginBottom={20} />
        <Text style={styles.minimalKicker}>ОФИЦИАЛЬНО</Text>
        <Text style={styles.minimalTitle}>Сертификат</Text>
        <Text style={styles.minimalSubtitle}>{taglineFor(data)}</Text>
        <View style={styles.minimalDivider} />
        <Text style={styles.minimalName}>{data.userName}</Text>
        <Text style={styles.minimalCourse}>{data.courseName}</Text>
        <Text style={styles.minimalMeta}>
          № {data.certNumber} · {data.date}
        </Text>
        {exp ? <Text style={styles.minimalExpiry}>Действителен до {exp}</Text> : null}
        <Text style={styles.minimalSchoolLine}>
          Настоящий сертификат удостоверяет успешное освоение программы и может использоваться как подтверждение
          квалификации в рамках методики школы.
        </Text>
      </View>
    </Page>
  );
}

export function CertificateElegant({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.page}>
      <ElegantBackgroundArt />
      <View style={styles.elegantRosetteTL} />
      <View style={styles.elegantRosetteTR} />
      <View style={styles.elegantRosetteBL} />
      <View style={styles.elegantRosetteBR} />
      <View style={styles.elegantBorder} />
      <View style={styles.elegantInner} />
      <View style={styles.elegantContent}>
        <CertificateSiteBrandMark marginBottom={14} />
        <ElegantFlourishHeader />
        <View style={styles.elegantBadge}>
          <Text style={styles.elegantBadgeText}>ОФИЦИАЛЬНАЯ ЗАПИСЬ О ПРОХОЖДЕНИИ</Text>
        </View>
        <Text style={styles.elegantTitle}>Сертификат</Text>
        <Text style={styles.elegantSubtitle}>{taglineFor(data)}</Text>
        <Text style={styles.elegantQuote}>
          «Образование — это не запоминание, а согласие тела с новым опытом.»
        </Text>
        <Text style={styles.elegantName}>{data.userName}</Text>
        <Text style={styles.elegantCourse}>успешно прошёл(ла) курс</Text>
        <Text style={styles.elegantCourseName}>{data.courseName}</Text>
        <View style={styles.elegantFooter}>
          <Text style={styles.elegantMeta}>№ {data.certNumber}</Text>
          <Text style={styles.elegantMeta}>{data.date}</Text>
        </View>
        {exp ? <Text style={styles.elegantExpiry}>Действителен до {exp}</Text> : null}
        <ElegantFlourishFooter />
        <Text style={styles.elegantBottomNote}>Школа «AVATERRA» · мышечное тестирование</Text>
      </View>
    </Page>
  );
}

/** Витрина: тело и тестирование — тёплая колонка «как на блоге», золото + нейтральный текст. */
