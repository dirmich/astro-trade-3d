/**
 * Initial Seed Data:
 * - 12 Space Resources with distinct tiers & base prices
 * - 30 Initial Planets named after Greek/Roman Mythology & Solar System Moons
 * - Expansion Pool of 20+ Additional Mythological/Moon Planets for Automatic Scaling
 * - Superuser account: oldtv.cf@gmail.com (Initial Password from .env: AstroAdmin!2026#)
 */
import { ENV } from '../config/env';
import { getDb } from './adapter';
import { calculateDynamicPrices } from '../services/economy';

export interface ResourceSeed {
  id: string;
  code: string;
  name_ko: string;
  name_en: string;
  tier: 'COMMON' | 'ADVANCED' | 'RARE' | 'EXOTIC' | 'LEGENDARY';
  base_price: number;
  unit_mass: number;
  color: string;
  description: string;
}

export const INITIAL_RESOURCES: ResourceSeed[] = [
  { id: 'res_fe_ti', code: 'FE_TI', name_ko: '철-티타늄 합금', name_en: 'Ferro-Titanium', tier: 'COMMON', base_price: 45, unit_mass: 1, color: '#94a3b8', description: '우주선 선체 장갑 및 궤도 구조물 제작용 기초 금속' },
  { id: 'res_si_cr', code: 'SI_CR', name_ko: '규소 결정체', name_en: 'Silicate Crystal', tier: 'COMMON', base_price: 70, unit_mass: 1, color: '#38bdf8', description: '광학 센서 및 태양광 집광판 제조용 고순도 규소' },
  { id: 'res_h2o', code: 'H2O_ICE', name_ko: '순수 빙하수', name_en: 'Cryo-Water Ice', tier: 'COMMON', base_price: 95, unit_mass: 1, color: '#60a5fa', description: '생명유지장치 및 수소 연료 전기분해용 필수 빙하 자원' },
  { id: 'res_ch4', code: 'CH4_GAS', name_ko: '액화 메탄', name_en: 'Liquid Methane', tier: 'COMMON', base_price: 130, unit_mass: 1, color: '#fbbf24', description: '극저온 로켓 추진제 및 플라즈마 냉각 매질' },
  { id: 'res_co_ore', code: 'CO_ORE', name_ko: '코발트 광석', name_en: 'Cobalt Ore', tier: 'ADVANCED', base_price: 210, unit_mass: 1, color: '#818cf8', description: '고용량 에너지 셀 및 자기장 차폐 코일 핵심 원료' },
  { id: 'res_pt_ir', code: 'PT_IR', name_ko: '백금-이리듐', name_en: 'Platinum-Iridium', tier: 'ADVANCED', base_price: 380, unit_mass: 1, color: '#e2e8f0', description: '초내열 추진 노즐 및 정밀 항법 자이로 코어 귀금속' },
  { id: 'res_he3', code: 'HE3', name_ko: '헬륨-3 동위원소', name_en: 'Helium-3 Isotope', tier: 'ADVANCED', base_price: 550, unit_mass: 1, color: '#34d399', description: '무방사능 핵융합 발전기 및 워프 보조 동력원' },
  { id: 'res_xe_pl', code: 'XE_PL', name_ko: '제논 플라즈마', name_en: 'Xenon Plasma', tier: 'RARE', base_price: 890, unit_mass: 1, color: '#c084fc', description: '고추력 이온 드라이브 및 고출력 채굴 레이저 증폭 매질' },
  { id: 'res_bio_sp', code: 'BIO_SP', name_ko: '제노 바이오 스포어', name_en: 'Xeno Bio-Spore', tier: 'RARE', base_price: 1350, unit_mass: 1, color: '#4ade80', description: '성간 항생제 및 세포 재생 치료제 합성에 쓰이는 외계 생물 포자' },
  { id: 'res_aether', code: 'AETHER', name_ko: '에테르 쿼츠', name_en: 'Aether Quartz', tier: 'RARE', base_price: 2200, unit_mass: 2, color: '#f472b6', description: '초공간 양자 통신기 및 중력파 센서 공명 결정' },
  { id: 'res_grav', code: 'GRAV_OR', name_ko: '그래비토늄', name_en: 'Gravitonium', tier: 'EXOTIC', base_price: 3800, unit_mass: 2, color: '#fb7185', description: '인공 중력장 생성 및 워프 버블 안정화용 초고밀도 물질' },
  { id: 'res_chrono', code: 'CHRONO', name_ko: '크로노 더스트', name_en: 'Chrono-Dust', tier: 'LEGENDARY', base_price: 6500, unit_mass: 2, color: '#facc15', description: '시공간 왜곡 항법 및 최상위 하이퍼드라이브 코어 전설 촉매' },
];

export interface PlanetSeedTemplate {
  name: string;
  name_ko: string;
  origin_category: 'GREEK_MYTH' | 'ROMAN_MYTH' | 'JUPITER_MOON' | 'SATURN_MOON' | 'URANUS_MOON' | 'NEPTUNE_MOON' | 'MARS_PLUTO_MOON';
  biome: 'TERRAN' | 'ICE' | 'VOLCANIC' | 'GAS_MOON' | 'DESERT' | 'OCEAN' | 'JUNGLE' | 'CRYSTAL';
  sector: string;
  abundant_codes: string[];
  scarce_codes: string[];
  has_rings: boolean;
  danger_level: number;
  specialty_desc: string;
}

export const INITIAL_30_PLANETS: PlanetSeedTemplate[] = [
  { name: 'Olympus Prime', name_ko: '올림푸스 프라임', origin_category: 'GREEK_MYTH', biome: 'TERRAN', sector: 'Core-Alpha', abundant_codes: ['FE_TI', 'SI_CR', 'H2O_ICE'], scarce_codes: ['CHRONO', 'GRAV_OR'], has_rings: true, danger_level: 1, specialty_desc: '그리스 신들의 산 이름을 딴 성간 연방 수도 행성. 기초 자원이 풍부하고 치안이 완벽함.' },
  { name: 'Titan', name_ko: '타이탄', origin_category: 'SATURN_MOON', biome: 'GAS_MOON', sector: 'Saturn-Ring', abundant_codes: ['CH4_GAS', 'HE3'], scarce_codes: ['BIO_SP', 'AETHER'], has_rings: true, danger_level: 1, specialty_desc: '토성 최대 위성. 액화 메탄 바다와 탄화수소 대기가 발달하여 연료 가격이 은하 최저가.' },
  { name: 'Europa', name_ko: '유로파', origin_category: 'JUPITER_MOON', biome: 'ICE', sector: 'Jovian-Belt', abundant_codes: ['H2O_ICE', 'BIO_SP'], scarce_codes: ['PT_IR', 'CO_ORE'], has_rings: false, danger_level: 1, specialty_desc: '목성의 얼음 위성. 두꺼운 빙하 아래 거대 지하 해양이 존재하며 순수 빙하수와 심해 포자가 풍부함.' },
  { name: 'Ganymede', name_ko: '가니메데', origin_category: 'JUPITER_MOON', biome: 'TERRAN', sector: 'Jovian-Belt', abundant_codes: ['FE_TI', 'CO_ORE'], scarce_codes: ['CHRONO', 'XE_PL'], has_rings: false, danger_level: 1, specialty_desc: '태양계 최대 위성. 독자적인 자기장을 보유하며 철-티타늄 및 코발트 광산이 밀집됨.' },
  { name: 'Io', name_ko: '이오', origin_category: 'JUPITER_MOON', biome: 'VOLCANIC', sector: 'Jovian-Belt', abundant_codes: ['CO_ORE', 'PT_IR', 'XE_PL'], scarce_codes: ['H2O_ICE', 'BIO_SP'], has_rings: false, danger_level: 3, specialty_desc: '수백 개의 활화산이 분출하는 목성 위성. 백금-이리듐과 코발트가 넘쳐나지만 빙하수가 극도로 귀함.' },
  { name: 'Callisto', name_ko: '칼리스토', origin_category: 'JUPITER_MOON', biome: 'DESERT', sector: 'Jovian-Belt', abundant_codes: ['FE_TI', 'HE3'], scarce_codes: ['BIO_SP', 'CH4_GAS'], has_rings: false, danger_level: 2, specialty_desc: '고대 충돌 크레이터로 뒤덮인 목성 외곽 위성. 헬륨-3 동위원소 노천 채굴 기지가 가동 중.' },
  { name: 'Enceladus', name_ko: '엔셀라두스', origin_category: 'SATURN_MOON', biome: 'ICE', sector: 'Saturn-Ring', abundant_codes: ['H2O_ICE', 'SI_CR'], scarce_codes: ['CO_ORE', 'GRAV_OR'], has_rings: true, danger_level: 1, specialty_desc: '남극 얼음 간헐천이 우주로 뿜어져 나오는 토성 위성. 최고 순도의 크라이오 워터 공급원.' },
  { name: 'Triton', name_ko: '트리톤', origin_category: 'NEPTUNE_MOON', biome: 'CRYSTAL', sector: 'Neptune-Deep', abundant_codes: ['AETHER', 'H2O_ICE', 'CH4_GAS'], scarce_codes: ['FE_TI', 'BIO_SP'], has_rings: false, danger_level: 3, specialty_desc: '해왕성의 역행 궤도 위성. 질소 얼음 지각 아래 에테르 쿼츠 결정 맥이 대량 매장됨.' },
  { name: 'Phobos', name_ko: '포보스', origin_category: 'MARS_PLUTO_MOON', biome: 'DESERT', sector: 'Inner-Sol', abundant_codes: ['FE_TI', 'SI_CR'], scarce_codes: ['HE3', 'AETHER'], has_rings: false, danger_level: 2, specialty_desc: '화성 근접 전술 궤도 위성. 함선 장갑용 철-티타늄 합금이 대량 제련되어 헐값에 거래됨.' },
  { name: 'Deimos', name_ko: '데이모스', origin_category: 'MARS_PLUTO_MOON', biome: 'DESERT', sector: 'Inner-Sol', abundant_codes: ['SI_CR', 'CO_ORE'], scarce_codes: ['H2O_ICE', 'BIO_SP'], has_rings: false, danger_level: 2, specialty_desc: '화성 외곽 소행성대 중계 기지. 규소 결정체와 코발트 원석 집하장.' },
  { name: 'Charon', name_ko: '카론', origin_category: 'MARS_PLUTO_MOON', biome: 'ICE', sector: 'Kuiper-Edge', abundant_codes: ['GRAV_OR', 'CH4_GAS'], scarce_codes: ['BIO_SP', 'SI_CR'], has_rings: false, danger_level: 4, specialty_desc: '명왕성의 이중 위성이자 카이퍼 벨트 관문. 중력 이상 광물인 그래비토늄이 채굴됨.' },
  { name: 'Rhea', name_ko: '레아', origin_category: 'SATURN_MOON', biome: 'ICE', sector: 'Saturn-Ring', abundant_codes: ['HE3', 'H2O_ICE'], scarce_codes: ['PT_IR', 'GRAV_OR'], has_rings: true, danger_level: 2, specialty_desc: '토성 제2위성. 희박한 산소 대기와 풍부한 헬륨-3 정제 플랜트를 보유.' },
  { name: 'Iapetus', name_ko: '이아페투스', origin_category: 'SATURN_MOON', biome: 'CRYSTAL', sector: 'Saturn-Ring', abundant_codes: ['SI_CR', 'AETHER'], scarce_codes: ['CH4_GAS', 'BIO_SP'], has_rings: false, danger_level: 2, specialty_desc: '밝은 반구와 어두운 반구가 공존하는 토성 위성. 적도 산맥에서 에테르 쿼츠가 산출됨.' },
  { name: 'Dione', name_ko: '디오네', origin_category: 'SATURN_MOON', biome: 'ICE', sector: 'Saturn-Ring', abundant_codes: ['H2O_ICE', 'XE_PL'], scarce_codes: ['CO_ORE', 'PT_IR'], has_rings: false, danger_level: 2, specialty_desc: '거대한 얼음 절벽으로 이루어진 토성 위성. 제논 플라즈마 포집 스테이션 운영 중.' },
  { name: 'Tethys', name_ko: '테티스', origin_category: 'SATURN_MOON', biome: 'ICE', sector: 'Saturn-Ring', abundant_codes: ['H2O_ICE', 'FE_TI'], scarce_codes: ['XE_PL', 'CHRONO'], has_rings: false, danger_level: 1, specialty_desc: '거대 오디세우스 분화구와 이타카 협곡이 자리한 빙하 채굴 기지.' },
  { name: 'Mimas', name_ko: '미마스', origin_category: 'SATURN_MOON', biome: 'DESERT', sector: 'Saturn-Ring', abundant_codes: ['FE_TI', 'PT_IR'], scarce_codes: ['BIO_SP', 'H2O_ICE'], has_rings: false, danger_level: 2, specialty_desc: '거대한 허셜 분화구 내부에 건설된 중공업 함선 수리 및 백금 제련 요새.' },
  { name: 'Oberon', name_ko: '오베론', origin_category: 'URANUS_MOON', biome: 'VOLCANIC', sector: 'Uranus-Rim', abundant_codes: ['PT_IR', 'CO_ORE'], scarce_codes: ['CH4_GAS', 'BIO_SP'], has_rings: false, danger_level: 3, specialty_desc: '천왕성 최외곽 대형 위성. 어두운 크레이터 바닥에서 고순도 백금-이리듐 광맥이 발견됨.' },
  { name: 'Titania', name_ko: '티타니아', origin_category: 'URANUS_MOON', biome: 'JUNGLE', sector: 'Uranus-Rim', abundant_codes: ['BIO_SP', 'H2O_ICE'], scarce_codes: ['GRAV_OR', 'PT_IR'], has_rings: false, danger_level: 2, specialty_desc: '천왕성 최대 위성. 지열 협곡 내부에 거대 바이오 돔이 구축되어 제노 바이오 스포어를 대량 배양.' },
  { name: 'Miranda', name_ko: '미란다', origin_category: 'URANUS_MOON', biome: 'CRYSTAL', sector: 'Uranus-Rim', abundant_codes: ['GRAV_OR', 'SI_CR'], scarce_codes: ['CH4_GAS', 'FE_TI'], has_rings: false, danger_level: 4, specialty_desc: '20km 높이의 베로나 단애와 기괴한 지각 조각이 얽힌 중력 이상 위성. 그래비토늄 주요 산지.' },
  { name: 'Ariel', name_ko: '아리엘', origin_category: 'URANUS_MOON', biome: 'ICE', sector: 'Uranus-Rim', abundant_codes: ['SI_CR', 'H2O_ICE', 'HE3'], scarce_codes: ['CO_ORE', 'CHRONO'], has_rings: false, danger_level: 2, specialty_desc: '천왕성 위성 중 가장 밝은 얼음 협곡 행성. 광학용 규소 결정과 헬륨-3가 저렴함.' },
  { name: 'Umbriel', name_ko: '움브리엘', origin_category: 'URANUS_MOON', biome: 'DESERT', sector: 'Uranus-Rim', abundant_codes: ['XE_PL', 'CO_ORE'], scarce_codes: ['H2O_ICE', 'SI_CR'], has_rings: false, danger_level: 3, specialty_desc: '태양빛을 거의 반사하지 않는 암흑 위성. 밀수업자들의 술집과 제논 플라즈마 암시장이 유명함.' },
  { name: 'Hyperion', name_ko: '히페리온', origin_category: 'SATURN_MOON', biome: 'CRYSTAL', sector: 'Saturn-Ring', abundant_codes: ['AETHER', 'SI_CR'], scarce_codes: ['FE_TI', 'H2O_ICE'], has_rings: false, danger_level: 3, specialty_desc: '불규칙한 자전과 스펀지 같은 다공성 내부 동굴을 지닌 위성. 동굴 심부에서 에테르 쿼츠가 채굴됨.' },
  { name: 'Phoebe', name_ko: '포에베', origin_category: 'SATURN_MOON', biome: 'DESERT', sector: 'Saturn-Ring', abundant_codes: ['PT_IR', 'HE3', 'CHRONO'], scarce_codes: ['BIO_SP', 'H2O_ICE'], has_rings: false, danger_level: 4, specialty_desc: '카이퍼 벨트에서 포획된 역행 위성. 태양계 초기의 원시 크로노 더스트 미량이 묻혀 있음.' },
  { name: 'Vulcan Forge', name_ko: '불칸 포지', origin_category: 'ROMAN_MYTH', biome: 'VOLCANIC', sector: 'Mythos-Core', abundant_codes: ['FE_TI', 'CO_ORE', 'PT_IR'], scarce_codes: ['H2O_ICE', 'BIO_SP'], has_rings: false, danger_level: 3, specialty_desc: '로마 대장장이 신 불카누스의 이름을 딴 용암 공업 행성. 모든 금속 광물이 매우 저렴함.' },
  { name: 'Athena Citadel', name_ko: '아테나 시타델', origin_category: 'GREEK_MYTH', biome: 'TERRAN', sector: 'Mythos-Core', abundant_codes: ['SI_CR', 'XE_PL'], scarce_codes: ['PT_IR', 'GRAV_OR'], has_rings: true, danger_level: 1, specialty_desc: '지혜와 전술의 여신 아테나를 기리는 첨단 연구 행성. 고성능 함선 개조소와 연구 단지가 위치함.' },
  { name: 'Apollo Helios', name_ko: '아폴로 헬리오스', origin_category: 'GREEK_MYTH', biome: 'DESERT', sector: 'Mythos-Core', abundant_codes: ['HE3', 'XE_PL'], scarce_codes: ['H2O_ICE', 'CH4_GAS'], has_rings: false, danger_level: 2, specialty_desc: '쌍성 항성에 근접한 고에너지 행성. 태양풍 포집기를 통해 헬륨-3와 제논 플라즈마를 대량 생산.' },
  { name: 'Artemis Haven', name_ko: '아르테미스 헤이븐', origin_category: 'GREEK_MYTH', biome: 'JUNGLE', sector: 'Mythos-Core', abundant_codes: ['BIO_SP', 'H2O_ICE'], scarce_codes: ['FE_TI', 'XE_PL'], has_rings: false, danger_level: 1, specialty_desc: '사냥과 달의 여신 아르테미스의 생태 행성. 희귀한 제노 바이오 스포어의 최대 공급지.' },
  { name: 'Hermes Nexus', name_ko: '헤르메스 넥서스', origin_category: 'GREEK_MYTH', biome: 'TERRAN', sector: 'Core-Alpha', abundant_codes: ['CH4_GAS', 'SI_CR', 'CO_ORE'], scarce_codes: ['CHRONO', 'AETHER'], has_rings: true, danger_level: 1, specialty_desc: '상업과 여행의 신 헤르메스의 이름을 딴 자유무역 허브. 거래 세율이 은하계에서 가장 낮음.' },
  { name: 'Poseidon Abyss', name_ko: '포세이돈 어비스', origin_category: 'GREEK_MYTH', biome: 'OCEAN', sector: 'Mythos-Core', abundant_codes: ['H2O_ICE', 'CH4_GAS', 'BIO_SP'], scarce_codes: ['SI_CR', 'PT_IR'], has_rings: false, danger_level: 2, specialty_desc: '행성 전체가 깊이 100km의 바다로 덮인 해양 행성. 부유 도시에서 수중 자원을 교역함.' },
  { name: 'Chronos Rift', name_ko: '크로노스 리프트', origin_category: 'GREEK_MYTH', biome: 'CRYSTAL', sector: 'Abyss-Omega', abundant_codes: ['CHRONO', 'GRAV_OR', 'AETHER'], scarce_codes: ['H2O_ICE', 'FE_TI', 'BIO_SP'], has_rings: true, danger_level: 5, specialty_desc: '시간의 신 크로노스의 이름이 붙은 심우주 중력 균열 행성. 전설급 크로노 더스트가 대량 매장됨.' },
];

export const EXPANSION_PLANET_POOL: PlanetSeedTemplate[] = [
  { name: 'Persephone Spring', name_ko: '페르세포네 스프링', origin_category: 'GREEK_MYTH', biome: 'JUNGLE', sector: 'Expansion-I', abundant_codes: ['BIO_SP', 'AETHER'], scarce_codes: ['FE_TI', 'CO_ORE'], has_rings: false, danger_level: 2, specialty_desc: '계절의 여신 페르세포네 행성. 주기적인 기후 변화 속에 고농축 바이오 포자가 자생함.' },
  { name: 'Hades Styx', name_ko: '하데스 스틱스', origin_category: 'GREEK_MYTH', biome: 'VOLCANIC', sector: 'Expansion-I', abundant_codes: ['GRAV_OR', 'PT_IR', 'CHRONO'], scarce_codes: ['H2O_ICE', 'BIO_SP'], has_rings: true, danger_level: 5, specialty_desc: '명계의 신 하데스가 지배하는 암흑 성운 행성. 초희귀 광물이 풍부하나 해적 출몰이 잦음.' },
  { name: 'Ares Bastion', name_ko: '아레스 바스티온', origin_category: 'GREEK_MYTH', biome: 'DESERT', sector: 'Expansion-I', abundant_codes: ['FE_TI', 'CO_ORE', 'XE_PL'], scarce_codes: ['BIO_SP', 'H2O_ICE'], has_rings: false, danger_level: 4, specialty_desc: '전쟁의 신 아레스의 군수 요새 행성. 무장 함선 개조와 중금속 거래가 활발함.' },
  { name: 'Proteus', name_ko: '프로테우스', origin_category: 'NEPTUNE_MOON', biome: 'CRYSTAL', sector: 'Neptune-Deep', abundant_codes: ['SI_CR', 'AETHER'], scarce_codes: ['CH4_GAS', 'BIO_SP'], has_rings: false, danger_level: 3, specialty_desc: '해왕성 제2위성. 다면체 암석 지형 내부에 고순도 에테르 결정이 매장됨.' },
  { name: 'Nereid', name_ko: '네레이드', origin_category: 'NEPTUNE_MOON', biome: 'ICE', sector: 'Neptune-Deep', abundant_codes: ['H2O_ICE', 'HE3', 'CHRONO'], scarce_codes: ['FE_TI', 'CO_ORE'], has_rings: false, danger_level: 3, specialty_desc: '극단적인 타원 궤도를 그리는 해왕성 위성. 심우주 궤도 구간에서 크로노 더스트를 포집함.' },
  { name: 'Amalthea', name_ko: '아말테아', origin_category: 'JUPITER_MOON', biome: 'VOLCANIC', sector: 'Jovian-Belt', abundant_codes: ['CO_ORE', 'PT_IR'], scarce_codes: ['H2O_ICE', 'BIO_SP'], has_rings: false, danger_level: 2, specialty_desc: '목성 방사선대 내부의 붉은 위성. 고밀도 금속 광석이 저렴하게 공급됨.' },
  { name: 'Janus Gate', name_ko: '야누스 게이트', origin_category: 'ROMAN_MYTH', biome: 'TERRAN', sector: 'Expansion-II', abundant_codes: ['HE3', 'XE_PL', 'CH4_GAS'], scarce_codes: ['GRAV_OR', 'AETHER'], has_rings: true, danger_level: 2, specialty_desc: '두 얼굴의 로마 신 야누스의 이름을 딴 쌍둥이 공전 궤도 교역 관문.' },
  { name: 'Minerva Sanctuary', name_ko: '미네르바 생추어리', origin_category: 'ROMAN_MYTH', biome: 'OCEAN', sector: 'Expansion-II', abundant_codes: ['H2O_ICE', 'BIO_SP', 'SI_CR'], scarce_codes: ['PT_IR', 'CHRONO'], has_rings: false, danger_level: 1, specialty_desc: '로마 지혜의 여신 미네르바의 해상 학술 도시 행성.' },
  { name: 'Jupiter Capitolinus', name_ko: '유피테르 카피톨리누스', origin_category: 'ROMAN_MYTH', biome: 'GAS_MOON', sector: 'Expansion-II', abundant_codes: ['HE3', 'CH4_GAS', 'XE_PL'], scarce_codes: ['FE_TI', 'SI_CR'], has_rings: true, danger_level: 3, specialty_desc: '초거대 가스 행성 상공의 부유 플랜트 단지. 가스 및 플라즈마 자원의 메카.' },
  { name: 'Neptune Trident', name_ko: '넵튠 트라이던트', origin_category: 'ROMAN_MYTH', biome: 'OCEAN', sector: 'Expansion-II', abundant_codes: ['H2O_ICE', 'AETHER', 'BIO_SP'], scarce_codes: ['FE_TI', 'CO_ORE'], has_rings: true, danger_level: 3, specialty_desc: '초고압 심해 열수구에서 에테르 결정과 외계 포자가 함께 채취되는 신비의 행성.' },
  { name: 'Mercury Caduceus', name_ko: '머큐리 카두세우스', origin_category: 'ROMAN_MYTH', biome: 'DESERT', sector: 'Expansion-III', abundant_codes: ['PT_IR', 'SI_CR', 'HE3'], scarce_codes: ['H2O_ICE', 'BIO_SP'], has_rings: false, danger_level: 2, specialty_desc: '항성 초근접 고속 공전 행성. 태양풍 헬륨-3와 백금 광맥의 보고.' },
  { name: 'Venus Aphrodite', name_ko: '비너스 아프로디테', origin_category: 'ROMAN_MYTH', biome: 'GAS_MOON', sector: 'Expansion-III', abundant_codes: ['XE_PL', 'AETHER', 'CH4_GAS'], scarce_codes: ['H2O_ICE', 'FE_TI'], has_rings: true, danger_level: 2, specialty_desc: '황금빛 구름 상층부에 떠 있는 호화 공중 정원 도시와 최고급 술집이 자리한 행성.' },
];

export const BIOME_COLORS: Record<string, { primary: string; secondary: string; atmo: string }> = {
  TERRAN: { primary: '#2563eb', secondary: '#10b981', atmo: '#60a5fa' },
  ICE: { primary: '#bae6fd', secondary: '#38bdf8', atmo: '#7dd3fc' },
  VOLCANIC: { primary: '#dc2626', secondary: '#f97316', atmo: '#fb923c' },
  GAS_MOON: { primary: '#d97706', secondary: '#fcd34d', atmo: '#fde68a' },
  DESERT: { primary: '#c2410c', secondary: '#fdba74', atmo: '#fed7aa' },
  OCEAN: { primary: '#0284c7', secondary: '#06b6d4', atmo: '#22d3ee' },
  JUNGLE: { primary: '#15803d', secondary: '#4ade80', atmo: '#86efac' },
  CRYSTAL: { primary: '#9333ea', secondary: '#f472b6', atmo: '#e879f9' },
};

export async function seedDatabaseIfNeeded() {
  const db = await getDb();
  const existingPlanets = await db.query<{ id: string }>('SELECT id FROM planets LIMIT 1');
  if (existingPlanets.length > 0) return;

  const now = new Date().toISOString();

  // 1. Seed 12 Resources
  for (const r of INITIAL_RESOURCES) {
    await db.run(
      `INSERT INTO resources (id, code, name_ko, name_en, tier, base_price, unit_mass, color, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.code, r.name_ko, r.name_en, r.tier, r.base_price, r.unit_mass, r.color, r.description]
    );
  }

  // 2. Seed Initial 30 Planets along a realistic 3D galactic spiral disk
  for (let i = 0; i < INITIAL_30_PLANETS.length; i++) {
    const p = INITIAL_30_PLANETS[i];
    const planetId = `planet_${i + 1}`;
    const angle = i * 0.72;
    const dist = 90 + i * 28;
    const x = Number((Math.cos(angle) * dist).toFixed(2));
    const z = Number((Math.sin(angle) * dist).toFixed(2));
    const y = Number((((i % 7) - 3) * 14).toFixed(2));
    const radius = Number((4.2 + (i % 5) * 1.15).toFixed(2));
    const palette = BIOME_COLORS[p.biome] || BIOME_COLORS.TERRAN;
    const taxRate = p.name === 'Hermes Nexus' ? 0.01 : Number((0.02 + (p.danger_level * 0.005)).toFixed(3));

    await db.run(
      `INSERT INTO planets (
        id, name, name_ko, origin_category, biome, sector,
        x, y, z, radius, color_primary, color_secondary, atmosphere_color,
        has_rings, tax_rate, danger_level, has_trading_post, has_repair_shop, has_tavern,
        specialty_desc, is_auto_expanded, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, 0, ?)`,
      [
        planetId, p.name, p.name_ko, p.origin_category, p.biome, p.sector,
        x, y, z, radius, palette.primary, palette.secondary, palette.atmo,
        p.has_rings ? 1 : 0, taxRate, p.danger_level, p.specialty_desc, now,
      ]
    );

    // 3. Seed Planet Market Stocks & Prices (Abundant = high stock & low price; Scarce = low stock & high price)
    for (const r of INITIAL_RESOURCES) {
      const isAbundant = p.abundant_codes.includes(r.code);
      const isScarce = p.scarce_codes.includes(r.code);

      const baseStock = 500;
      let stock = 420 + ((i * 37) % 180);
      let specialtyMult = 1.0;
      let prodRate = 12;

      if (isAbundant) {
        stock = 1350 + ((i * 53) % 450); // Very high stock -> cheap price!
        specialtyMult = 0.58;
        prodRate = 35;
      } else if (isScarce) {
        stock = 35 + ((i * 19) % 45); // Very scarce stock -> high price!
        specialtyMult = 1.65;
        prodRate = 2;
      }

      const { buyPrice, sellPrice } = calculateDynamicPrices(r.base_price, stock, baseStock, specialtyMult, taxRate);

      await db.run(
        `INSERT INTO planet_markets (
          planet_id, resource_id, stock, base_stock, production_rate, specialty_multiplier, buy_price, sell_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planetId, r.id, stock, baseStock, prodRate, specialtyMult, buyPrice, sellPrice]
      );
    }
  }

  // 4. Seed Superuser (oldtv.cf@gmail.com)
  await db.run(
    `INSERT INTO users (
      id, email, password_hash, pilot_name, role, credits, current_planet_id,
      ship_name, ship_tier, hull, max_hull, fuel, max_fuel, cargo_capacity,
      mining_laser_level, warp_drive_level, shield_level, cargo_json, crew_json,
      reputation, total_trades, total_mined, created_at
    ) VALUES (?, ?, ?, ?, 'SUPERADMIN', 500000, 'planet_1', 'Olympus Sovereign X-99', 3, 220, 220, 200, 200, 180, 3, 3, 3, '{}', '[]', 999, 0, 0, ?)`,
    ['user_superadmin', ENV.SUPERUSER_EMAIL, ENV.SUPERUSER_INITIAL_PASSWORD, 'Supreme Commander (Admin)', now]
  );
}
