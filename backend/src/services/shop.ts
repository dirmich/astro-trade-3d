/**
 * Planetary Shop, Sector Star Maps (Time-Limited), Emergency In-Flight Map Purchase (10x Price, Max 3),
 * and Multi-Tier Item/Artifact System (`backend/src/services/shop.ts`)
 */
import { getDb } from '../db/adapter';

export type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
export type ItemCategory = 'MAP' | 'CONSUMABLE' | 'EQUIPMENT' | 'RELIC';

export interface ShopItemSpec {
  id: string;
  name_ko: string;
  name_en: string;
  category: ItemCategory;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  rarity: ItemRarity;
  base_price: number;
  emergency_price?: number; // 10x price for emergency in-flight map purchase
  target_sector?: string;
  duration_sec?: number; // Duration in seconds for sector maps
  image_url: string;
  description: string;
  effect_summary: string;
  allowed_biomes?: string[];
  min_danger?: number;
  pirate_only?: boolean; // Exclusive pirate loot drop — never sold in planetary shops!
  min_pirate_level?: number;
}

export const ALL_SECTORS = [
  'Core-Alpha',
  'Inner-Sol',
  'Jovian-Belt',
  'Saturn-Ring',
  'Uranus-Rim',
  'Neptune-Deep',
  'Kuiper-Edge',
  'Mythos-Core',
  'Abyss-Omega',
];

export const SHOP_ITEMS: ShopItemSpec[] = [
  // =========================================================================
  // 1. SECTOR STAR MAPS (구역별 우주지도 — 정해진 유효시간 동안 해당 구역 성도 표시)
  // =========================================================================
  {
    id: 'map_core_alpha',
    name_ko: '코어-알파 항로 우주지도',
    name_en: 'Core-Alpha Sector Chart',
    category: 'MAP',
    level: 1,
    rarity: 'COMMON',
    base_price: 800,
    emergency_price: 8000,
    target_sector: 'Core-Alpha',
    duration_sec: 900, // 15분
    image_url: '/items/map_core_alpha.svg',
    description: '올림푸스 프라임과 헤르메스 넥서스가 위치한 성간 연방 핵심 구역의 정밀 항로 지도입니다.',
    effect_summary: '15분간 [Core-Alpha] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_inner_sol',
    name_ko: '내태양계 전술 우주지도',
    name_en: 'Inner-Sol Tactical Chart',
    category: 'MAP',
    level: 1,
    rarity: 'COMMON',
    base_price: 950,
    emergency_price: 9500,
    target_sector: 'Inner-Sol',
    duration_sec: 900, // 15분
    image_url: '/items/map_inner_sol.svg',
    description: '포보스와 데이모스 군수 기지가 밀집한 내태양계 전술 궤도 성도입니다.',
    effect_summary: '15분간 [Inner-Sol] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_jovian_belt',
    name_ko: '목성 위성군 항법 우주지도',
    name_en: 'Jovian-Belt Navigation Chart',
    category: 'MAP',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 1200,
    emergency_price: 12000,
    target_sector: 'Jovian-Belt',
    duration_sec: 1200, // 20분
    image_url: '/items/map_jovian_belt.svg',
    description: '유로파, 가니메데, 이오, 칼리스토를 잇는 목성 고자기장 항로 지도입니다.',
    effect_summary: '20분간 [Jovian-Belt] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_saturn_ring',
    name_ko: '토성 고리 성단 정밀지도',
    name_en: 'Saturn-Ring Precision Chart',
    category: 'MAP',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 1400,
    emergency_price: 14000,
    target_sector: 'Saturn-Ring',
    duration_sec: 1200, // 20분
    image_url: '/items/map_saturn_ring.svg',
    description: '타이탄과 엔셀라두스 등 토성 고리 내부의 얼음 위성군 충돌 회피 항법 지도입니다.',
    effect_summary: '20분간 [Saturn-Ring] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_uranus_rim',
    name_ko: '천왕성 외곽 림 성도',
    name_en: 'Uranus-Rim Deep Chart',
    category: 'MAP',
    level: 3,
    rarity: 'RARE',
    base_price: 1800,
    emergency_price: 18000,
    target_sector: 'Uranus-Rim',
    duration_sec: 1500, // 25분
    image_url: '/items/map_uranus_rim.svg',
    description: '오베론, 티타니아, 미란다 등 중력 이상 지대가 도사리는 천왕성 외곽 항법 지도입니다.',
    effect_summary: '25분간 [Uranus-Rim] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_neptune_deep',
    name_ko: '해왕성 심해 성운 지도',
    name_en: 'Neptune-Deep Nebula Chart',
    category: 'MAP',
    level: 3,
    rarity: 'RARE',
    base_price: 2100,
    emergency_price: 21000,
    target_sector: 'Neptune-Deep',
    duration_sec: 1500, // 25분
    image_url: '/items/map_neptune_deep.svg',
    description: '역행 위성 트리톤과 해왕성 심우주 궤도를 탐사하기 위한 기밀 항해 성도입니다.',
    effect_summary: '25분간 [Neptune-Deep] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_kuiper_edge',
    name_ko: '카이퍼 변경 암흑 성도',
    name_en: 'Kuiper-Edge Dark Chart',
    category: 'MAP',
    level: 4,
    rarity: 'EPIC',
    base_price: 2800,
    emergency_price: 28000,
    target_sector: 'Kuiper-Edge',
    duration_sec: 1800, // 30분
    image_url: '/items/map_kuiper_edge.svg',
    description: '명왕성 위성 카론과 카이퍼 벨트 그래비토늄 광맥을 표시한 영웅 등급 항법 지도입니다.',
    effect_summary: '30분간 [Kuiper-Edge] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_mythos_core',
    name_ko: '미토스 신화 성역 고대성도',
    name_en: 'Mythos-Core Ancient Chart',
    category: 'MAP',
    level: 4,
    rarity: 'EPIC',
    base_price: 3200,
    emergency_price: 32000,
    target_sector: 'Mythos-Core',
    duration_sec: 1800, // 30분
    image_url: '/items/map_mythos_core.svg',
    description: '불칸 포지, 아테나 시타델, 포세이돈 어비스 등 신화 성역의 초공간 항로 지도입니다.',
    effect_summary: '30분간 [Mythos-Core] 구역 행성 좌표·시세·항로 개방',
  },
  {
    id: 'map_abyss_omega',
    name_ko: '어비스-오메가 균열 금서 성도',
    name_en: 'Abyss-Omega Forbidden Chart',
    category: 'MAP',
    level: 5,
    rarity: 'LEGENDARY',
    base_price: 4500,
    emergency_price: 45000,
    target_sector: 'Abyss-Omega',
    duration_sec: 2400, // 40분
    image_url: '/items/map_abyss_omega.svg',
    description: '전설의 크로노스 리프트와 확장 심우주 구역까지 관통하는 전설급 시공 항법 지도입니다.',
    effect_summary: '40분간 [Abyss-Omega] 및 외곽 확장 구역 전체 개방',
  },
  {
    id: 'map_all_galaxy',
    name_ko: '아스트랄 전 은하 마스터 성도',
    name_en: 'Astral Omniverse Master Chart',
    category: 'MAP',
    level: 6,
    rarity: 'MYTHIC',
    base_price: 12000,
    emergency_price: 120000,
    target_sector: 'ALL_GALAXY',
    duration_sec: 3600, // 60분
    image_url: '/items/map_all_galaxy.svg',
    description: '은하계 모든 섹터의 행성 위치, 위험도, 실시간 교역 시세를 한눈에 밝히는 신화 등급 마스터 성도입니다.',
    effect_summary: '60분간 은하계 전 구역(ALL SECTORS) 우주지도 완전 개방',
  },

  // =========================================================================
  // 2. CONSUMABLES, EQUIPMENT & MYTHIC RELICS (행성별 특산 아이템 & 장비 & 유물)
  // =========================================================================
  {
    id: 'item_repair_kit',
    name_ko: '응급 나노 수리 패치',
    name_en: 'Nano-Hull Repair Kit',
    category: 'CONSUMABLE',
    level: 1,
    rarity: 'COMMON',
    base_price: 450,
    image_url: '/items/item_repair_kit.svg',
    description: '항해 중 언제든 선체 균열을 메울 수 있는 자가 복구 나노봇 키트입니다.',
    effect_summary: '선체 내구도(Hull) +50 즉시 회복 (보유/즉시사용)',
  },
  {
    id: 'item_fuel_cell',
    name_ko: '고밀도 중수소 연료 셀',
    name_en: 'Deuterium Hyper-Fuel Cell',
    category: 'CONSUMABLE',
    level: 1,
    rarity: 'COMMON',
    base_price: 380,
    image_url: '/items/item_fuel_cell.svg',
    description: '직접 운행 및 워프 항해 중 비상 동력을 공급하는 압축 중수소 배터리입니다.',
    effect_summary: '함선 연료(Fuel) +60 즉시 충전 (보유/즉시사용)',
  },
  {
    id: 'item_afterburner_chip',
    name_ko: '플라즈마 애프터버너 칩',
    name_en: 'Plasma Afterburner Chip',
    category: 'EQUIPMENT',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 1600,
    image_url: '/items/item_afterburner_chip.svg',
    description: '이온 스러스터의 분사 압력을 높여 직접 운행 시 비행 속도를 대폭 높여주는 튜닝 칩입니다.',
    effect_summary: '직접 운행 최고 속도 +25% 영구 증가 & 연료 +20',
    allowed_biomes: ['TERRAN', 'GAS_MOON', 'DESERT'],
  },
  {
    id: 'item_mining_drone',
    name_ko: '자동 공명 채굴 드론 MK-II',
    name_en: 'Resonance Mining Drone MK-II',
    category: 'EQUIPMENT',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 2200,
    image_url: '/items/item_mining_drone.svg',
    description: '함선 주위를 선회하며 소행성 광맥을 정밀 타격하는 자율 채굴 보조 드론입니다.',
    effect_summary: '채굴 레이저 레벨 +1 영구 상승',
    allowed_biomes: ['VOLCANIC', 'DESERT', 'ICE'],
  },
  {
    id: 'item_cargo_pod',
    name_ko: '자력 압축 화물 컨테이너',
    name_en: 'Mag-Compression Cargo Pod',
    category: 'EQUIPMENT',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 2900,
    image_url: '/items/item_cargo_pod.svg',
    description: '자기장 공간 압축 기술을 적용해 함선 외벽에 부착하는 확장 화물 모듈입니다.',
    effect_summary: '최대 화물칸 용량(Cargo) +30 영구 확장',
    allowed_biomes: ['TERRAN', 'VOLCANIC', 'OCEAN'],
  },
  {
    id: 'item_shield_booster',
    name_ko: '이이지스 양자 실드 증폭기',
    name_en: 'Aegis Quantum Shield Booster',
    category: 'EQUIPMENT',
    level: 3,
    rarity: 'RARE',
    base_price: 4200,
    image_url: '/items/item_shield_booster.svg',
    description: '이온 폭풍과 우주 해적의 포격을 튕겨내는 다중 위상 방어막 코어입니다.',
    effect_summary: '실드 레벨 +1 상승 & 최대 선체 내구도 +35 증가',
    allowed_biomes: ['TERRAN', 'CRYSTAL', 'ICE'],
  },
  {
    id: 'item_pirate_jammer',
    name_ko: '스텔스 스펙트럼 재머',
    name_en: 'Stealth Spectrum Jammer',
    category: 'EQUIPMENT',
    level: 3,
    rarity: 'RARE',
    base_price: 3800,
    image_url: '/items/item_pirate_jammer.svg',
    description: '해적 레이더망을 교란하여 위험 구역 항해 시 피격 피해를 크게 줄이고 기동성을 높입니다.',
    effect_summary: '실드 레벨 +1 상승 & 직접 운행 속도 +15% 증가',
    allowed_biomes: ['DESERT', 'GAS_MOON', 'JUNGLE'],
    min_danger: 2,
  },
  {
    id: 'item_trade_license',
    name_ko: '헤르메스 자유무역 면세 인장',
    name_en: 'Hermes Duty-Free Seal',
    category: 'EQUIPMENT',
    level: 3,
    rarity: 'RARE',
    base_price: 5000,
    image_url: '/items/item_trade_license.svg',
    description: '성간 상업 길드에서 발행하는 귀빈 전용 인장으로, 함대 평판과 화물 적재력을 높여줍니다.',
    effect_summary: '성간 평판 +60 상승 & 화물칸 용량 +25 확장',
    allowed_biomes: ['TERRAN', 'OCEAN', 'JUNGLE'],
  },
  {
    id: 'item_warp_stabilizer',
    name_ko: '타키온 워프 코어 안정기',
    name_en: 'Tachyon Warp Core Stabilizer',
    category: 'EQUIPMENT',
    level: 4,
    rarity: 'EPIC',
    base_price: 7500,
    image_url: '/items/item_warp_stabilizer.svg',
    description: '초공간 도약 시 소모되는 연료를 획기적으로 절감하고 연료 탱크를 확장하는 영웅 등급 부품입니다.',
    effect_summary: '워프 드라이브 레벨 +1 상승 & 최대 연료 +50 확장',
    allowed_biomes: ['CRYSTAL', 'GAS_MOON', 'VOLCANIC'],
    min_danger: 2,
  },
  {
    id: 'item_deep_scanner',
    name_ko: '심우주 아카식 광맥 스캐너',
    name_en: 'Akashic Deep-Space Scanner',
    category: 'EQUIPMENT',
    level: 4,
    rarity: 'EPIC',
    base_price: 8200,
    image_url: '/items/item_deep_scanner.svg',
    description: '초장거리 중력파 스캔으로 인접 구역 성도를 해금하고 숨겨진 에테르 결정을 포집합니다.',
    effect_summary: '무작위 3개 구역 우주지도 30분 개방 + 채굴 레벨 +1',
    allowed_biomes: ['ICE', 'CRYSTAL', 'OCEAN'],
    min_danger: 2,
  },
  {
    id: 'item_valkyrie_thruster',
    name_ko: '발키리 오버드라이브 엔진',
    name_en: 'Valkyrie Overdrive Thruster',
    category: 'EQUIPMENT',
    level: 4,
    rarity: 'EPIC',
    base_price: 9800,
    image_url: '/items/item_valkyrie_thruster.svg',
    description: '군용 강습함에 탑재되는 반물질 추진 엔진으로, 직접 운행 속도를 비약적으로 끌어올립니다.',
    effect_summary: '직접 운행 최고 속도 +50% 증가 & 최대 연료 +60 & 연료 완충',
    allowed_biomes: ['VOLCANIC', 'DESERT', 'TERRAN'],
    min_danger: 2,
  },
  {
    id: 'item_aegis_matrix',
    name_ko: '포세이돈 심해 불멸 장갑판',
    name_en: 'Poseidon Immortal Hull Matrix',
    category: 'RELIC',
    level: 5,
    rarity: 'LEGENDARY',
    base_price: 15000,
    image_url: '/items/item_aegis_matrix.svg',
    description: '초고압 심해 행성의 결정질 합금으로 주조된 전설 등급 외장 장갑 매트릭스입니다.',
    effect_summary: '최대 선체 내구도 +100 영구 강화 & 선체 100% 완전 수리 & 실드 +1',
    allowed_biomes: ['OCEAN', 'ICE', 'TERRAN'],
    min_danger: 2,
  },
  {
    id: 'item_midas_alchemizer',
    name_ko: '불카누스의 연금술 변환 코어',
    name_en: 'Vulcan Alchemical Transmuter',
    category: 'RELIC',
    level: 5,
    rarity: 'LEGENDARY',
    base_price: 18500,
    image_url: '/items/item_midas_alchemizer.svg',
    description: '우주 진공 에너지를 응축해 고부가가치 희귀 광물(그래비토늄·에테르 쿼츠)을 즉시 연성합니다.',
    effect_summary: '그래비토늄 8개 + 에테르 쿼츠 10개 화물칸 즉시 생성 & 화물칸 +40',
    allowed_biomes: ['VOLCANIC', 'CRYSTAL'],
    min_danger: 3,
  },
  {
    id: 'item_chrono_relic',
    name_ko: '크로노스의 시공 왜곡 성유물',
    name_en: 'Chronos Singularity Relic',
    category: 'RELIC',
    level: 6,
    rarity: 'MYTHIC',
    base_price: 35000,
    image_url: '/items/item_chrono_relic.svg',
    description: '시간의 신 크로노스의 균열에서 발굴된 신화 등급 고대 유물. 함선의 모든 성능을 초월시킵니다.',
    effect_summary: '전 은하 성도 2시간 개방 + 전 스탯(워프/채굴/실드) +1 + 직접운행 속도 +40% + 선체/연료 +80',
    allowed_biomes: ['CRYSTAL', 'VOLCANIC', 'JUNGLE'],
    min_danger: 3,
  },

  // =========================================================================
  // 3. WARP JUMP CELLS & AI AUTOPILOT AGENTS (워프 티켓 & 횟수제 AI 자동운행 에이전트)
  // =========================================================================
  {
    id: 'item_ai_pilot_basic',
    name_ko: '베이직 AI 항법 에이전트 (3회권)',
    name_en: 'Basic AI Autopilot Agent (3 Uses)',
    category: 'CONSUMABLE',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 1200,
    image_url: '/items/item_ai_pilot_basic.svg',
    description: '워프보다 훨씬 저렴하게 소행성 파편과 해적을 회피하며 목표 행성까지 자동으로 운항해주는 AI 파일럿 모듈입니다.',
    effect_summary: 'AI 자동 운행(Autopilot) 횟수 +3회 충전 (회당 400 CR 꼴)',
  },
  {
    id: 'item_ai_pilot_pro',
    name_ko: '퀀텀 AI 자율주행 에이전트 (8회권)',
    name_en: 'Quantum AI Autopilot Pro (8 Uses)',
    category: 'EQUIPMENT',
    level: 3,
    rarity: 'RARE',
    base_price: 2800,
    image_url: '/items/item_ai_pilot_pro.svg',
    description: '고도화된 신경망 항법 연산으로 태양풍과 파편 지대를 안전하게 돌파하는 대용량 AI 자동운행 패키지입니다.',
    effect_summary: 'AI 자동 운행(Autopilot) 횟수 +8회 충전 & 직접운행 속도 +10%',
  },
  {
    id: 'item_warp_cell_1',
    name_ko: '초공간 워프 점프 셀 (1회권)',
    name_en: 'Hyperspace Warp Jump Cell (1x)',
    category: 'CONSUMABLE',
    level: 3,
    rarity: 'RARE',
    base_price: 4500,
    image_url: '/items/item_warp_cell_1.svg',
    description: '행성 간 위험 지대(소행성 조각·태양풍·우주쓰레기)를 단번에 건너뛰는 고가의 초공간 워프 코어 캡슐입니다.',
    effect_summary: '초공간 워프 티켓(Warp Cell) +1회 충전',
  },
  {
    id: 'item_warp_cell_3',
    name_ko: '대용량 워프 점프 코어 팩 (3회권)',
    name_en: 'Heavy Warp Jump Core Pack (3x)',
    category: 'EQUIPMENT',
    level: 4,
    rarity: 'EPIC',
    base_price: 12000,
    image_url: '/items/item_warp_cell_3.svg',
    description: '장거리 무역 선단을 위한 3연속 초공간 도약 에너지 팩입니다. 돈을 모아 구매해야 하는 필수 고급 항법 물자입니다.',
    effect_summary: '초공간 워프 티켓(Warp Cell) +3회 충전 & 연료 +40',
  },

  // =========================================================================
  // 4. PIRATE-EXCLUSIVE LOOT DROPS (상점 비매품! 해적 격파 시 레벨별 전용 전리품)
  // =========================================================================
  {
    id: 'loot_pirate_scrap_core',
    name_ko: '[해적전리품] 개조 과부하 동력코어',
    name_en: '[Pirate Loot] Overclocked Raider Core',
    category: 'RELIC',
    level: 2,
    rarity: 'UNCOMMON',
    base_price: 3200,
    image_url: '/items/loot_pirate_scrap_core.svg',
    description: '⚠️ [상점 비매품] 우주해적 정찰기(Lv.1~3)를 격파했을 때만 노획할 수 있는 불법 개조 동력 코어입니다.',
    effect_summary: '[비매품 전리품] 채굴 레이저 +1 & 연료 +50 & 자산가치 상승',
    pirate_only: true,
    min_pirate_level: 1,
  },
  {
    id: 'loot_corsair_plasma_cannon',
    name_ko: '[해적전리품] 코르세어 약탈자 플라즈마 함포',
    name_en: '[Pirate Loot] Corsair Plasma Siege Cannon',
    category: 'RELIC',
    level: 3,
    rarity: 'RARE',
    base_price: 6800,
    image_url: '/items/loot_corsair_plasma_cannon.svg',
    description: '⚠️ [상점 비매품] 중급 해적선(Lv.2~5) 격파 시 드랍되는 고출력 약탈 함포로, 전투력과 방어력을 동시에 끌어올립니다.',
    effect_summary: '[비매품 전리품] 실드 레벨 +1 & 채굴/무장 레벨 +1 & 최대 선체 +40',
    pirate_only: true,
    min_pirate_level: 2,
  },
  {
    id: 'loot_void_nav_blackbox',
    name_ko: '[해적전리품] 해적선장의 암흑 항법 블랙박스',
    name_en: '[Pirate Loot] Pirate Lord Dark Nav-Blackbox',
    category: 'RELIC',
    level: 4,
    rarity: 'EPIC',
    base_price: 14000,
    image_url: '/items/loot_void_nav_blackbox.svg',
    description: '⚠️ [상점 비매품] 정예 우주해적(Lv.4~7)의 함교에서 탈취한 암호화 블랙박스. 고가의 워프 셀과 AI 항법 코드가 들어있습니다.',
    effect_summary: '[비매품 전리품] 워프 티켓 +2회 & AI 자동운행 +4회 & 2개 구역 지도 개방',
    pirate_only: true,
    min_pirate_level: 4,
  },
  {
    id: 'loot_dreadnought_singularity',
    name_ko: '[해적전리품] 드레드노트 반물질 특이점 엔진',
    name_en: '[Pirate Loot] Dreadnought Singularity Engine',
    category: 'RELIC',
    level: 5,
    rarity: 'LEGENDARY',
    base_price: 28000,
    image_url: '/items/loot_dreadnought_singularity.svg',
    description: '⚠️ [상점 비매품] 고레벨 해적 주력함(Lv.6~9)을 협동 또는 단독 격파해야만 얻을 수 있는 전설급 반물질 추진기입니다.',
    effect_summary: '[비매품 전리품] 직접운행 속도 +45% & 워프 레벨 +1 & 최대 선체 +90 & 워프 티켓 +2',
    pirate_only: true,
    min_pirate_level: 6,
  },
  {
    id: 'loot_leviathan_crown',
    name_ko: '[해적전리품] 해적황제 레비아탄의 심연 왕관',
    name_en: '[Pirate Loot] Abyssal Crown of Leviathan',
    category: 'RELIC',
    level: 6,
    rarity: 'MYTHIC',
    base_price: 65000,
    image_url: '/items/loot_leviathan_crown.svg',
    description: '⚠️ [상점 비매품] 최상위 해적 기함(Lv.8~10)을 다른 유저들과 협동 공격해 물리쳤을 때 획득 가능한 신화 등급 전리품입니다.',
    effect_summary: '[비매품 신화 전리품] 워프 티켓 +4 & AI 운행 +6 & 전 스탯 +2 & 전 은하 성도 개방',
    pirate_only: true,
    min_pirate_level: 8,
  },
];

export interface PlanetShopEntry extends ShopItemSpec {
  planet_price: number;
  is_specialty: boolean;
  discount_pct: number;
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Generates a planet-specific shop inventory so different planets sell different items and maps!
 */
export function getPlanetShopAssortment(planet: any): PlanetShopEntry[] {
  if (!planet) return [];
  const pHash = hashCode(planet.id + '_' + planet.name);
  const results: PlanetShopEntry[] = [];

  // 1. Maps sold on this planet:
  // Include all sector maps so players can purchase any sector chart at planetary shops
  // (the planet's own sector chart gets a 15% local specialty discount).
  const mapItems = SHOP_ITEMS.filter((it) => it.category === 'MAP');
  const selectedMaps = new Map<string, ShopItemSpec>();
  for (const m of mapItems) {
    if (m.target_sector === 'ALL_GALAXY') {
      if (planet.danger_level >= 3 || ['Olympus Prime', 'Hermes Nexus', 'Athena Citadel', 'Chronos Rift'].includes(planet.name)) {
        selectedMaps.set(m.id, m);
      }
    } else {
      selectedMaps.set(m.id, m);
    }
  }

  for (const m of selectedMaps.values()) {
    const isOwnSector = m.target_sector === planet.sector;
    const mult = isOwnSector ? 0.85 : 1.0 + (planet.tax_rate || 0.03);
    const planetPrice = Math.max(100, Math.round((m.base_price * mult) / 10) * 10);
    results.push({
      ...m,
      planet_price: planetPrice,
      is_specialty: isOwnSector || m.level >= 5,
      discount_pct: isOwnSector ? 15 : 0,
    });
  }

  // 2. Always include basic survival consumables, AI Pilot Agent, and Warp Cell
  for (const basicId of ['item_repair_kit', 'item_fuel_cell', 'item_ai_pilot_basic', 'item_warp_cell_1']) {
    const item = SHOP_ITEMS.find((i) => i.id === basicId)!;
    const isFuelPlanet = ['GAS_MOON', 'ICE', 'OCEAN'].includes(planet.biome) && basicId === 'item_fuel_cell';
    const isRepairPlanet = ['TERRAN', 'VOLCANIC'].includes(planet.biome) && basicId === 'item_repair_kit';
    const mult = isFuelPlanet || isRepairPlanet ? 0.8 : 1.0 + (planet.tax_rate || 0.03);
    results.push({
      ...item,
      planet_price: Math.round((item.base_price * mult) / 10) * 10,
      is_specialty: isFuelPlanet || isRepairPlanet,
      discount_pct: isFuelPlanet || isRepairPlanet ? 20 : 0,
    });
  }

  // 3. Planet-specific Equipment & Rare Relics (varies by biome, danger level, and planet hash; NEVER includes pirate_only loot!)
  const specialPool = SHOP_ITEMS.filter(
    (it) =>
      !it.pirate_only &&
      it.category !== 'MAP' &&
      !['item_repair_kit', 'item_fuel_cell', 'item_ai_pilot_basic', 'item_warp_cell_1'].includes(it.id)
  );

  for (let idx = 0; idx < specialPool.length; idx++) {
    const item = specialPool[idx];
    const biomeMatches = !item.allowed_biomes || item.allowed_biomes.includes(planet.biome);
    const dangerMatches = !item.min_danger || planet.danger_level >= item.min_danger;
    const hashPick = (pHash + idx * 7) % 3 === 0;

    // Include if it matches biome & danger, OR if hashPick selects it as a rare trader stock
    if ((biomeMatches && dangerMatches) || (hashPick && item.level <= planet.danger_level + 2)) {
      const isSpecialty = Boolean(biomeMatches && item.level >= 3);
      const priceFactor = isSpecialty
        ? 0.88
        : 0.95 + ((pHash + idx * 13) % 20) * 0.01 + (planet.tax_rate || 0.03);
      const planetPrice = Math.round((item.base_price * priceFactor) / 10) * 10;
      results.push({
        ...item,
        planet_price: planetPrice,
        is_specialty: isSpecialty,
        discount_pct: isSpecialty ? 12 : 0,
      });
    }
  }

  return results.sort((a, b) => {
    if (a.category === 'MAP' && b.category !== 'MAP') return -1;
    if (a.category !== 'MAP' && b.category === 'MAP') return 1;
    return a.level - b.level;
  });
}

/**
 * Helper to apply an item's effect to user state
 */
export async function applyItemEffectToUser(
  user: any,
  item: ShopItemSpec,
  keepInInventory: boolean = true
): Promise<{ effectMessage: string }> {
  const db = await getDb();
  const nowMs = Date.now();
  const inventory: Record<string, number> = JSON.parse(user.inventory_json || '{}');
  const unlockedMaps: Record<string, number> = JSON.parse(user.unlocked_maps_json || '{}');
  const cargo: Record<string, number> = JSON.parse(user.cargo_json || '{}');

  if (keepInInventory) {
    inventory[item.id] = (inventory[item.id] || 0) + 1;
  }

  let hull = Number(user.hull);
  let maxHull = Number(user.max_hull);
  let fuel = Number(user.fuel);
  let maxFuel = Number(user.max_fuel);
  let cargoCap = Number(user.cargo_capacity);
  let laserLv = Number(user.mining_laser_level);
  let warpLv = Number(user.warp_drive_level);
  let shieldLv = Number(user.shield_level);
  let reputation = Number(user.reputation);
  let speedBonus = Number(user.flight_speed_bonus || 1.0);
  let warpTickets = Number(user.warp_tickets || 0);
  let aiAgentUses = Number(user.ai_agent_uses || 0);
  let effectMessage = '';

  if (item.category === 'MAP') {
    const durMs = (item.duration_sec || 900) * 1000;
    if (item.target_sector === 'ALL_GALAXY') {
      for (const sec of ALL_SECTORS) {
        const baseTime = Math.max(nowMs, unlockedMaps[sec] || 0);
        unlockedMaps[sec] = baseTime + durMs;
      }
      unlockedMaps['ALL_GALAXY'] = Math.max(nowMs, unlockedMaps['ALL_GALAXY'] || 0) + durMs;
      effectMessage = `🌌 [전 은하 마스터 성도 개방] ${Math.round((item.duration_sec || 3600) / 60)}분 동안 모든 구역의 우주지도가 활성화되었습니다!`;
    } else if (item.target_sector) {
      const baseTime = Math.max(nowMs, unlockedMaps[item.target_sector] || 0);
      unlockedMaps[item.target_sector] = baseTime + durMs;
      effectMessage = `🗺️ [${item.target_sector} 우주지도 개방] ${Math.round((item.duration_sec || 900) / 60)}분 동안 해당 구역의 항로 및 행성 정보가 표시됩니다!`;
    }
  } else {
    switch (item.id) {
      case 'item_repair_kit':
        hull = Math.min(maxHull, hull + 50);
        effectMessage = `🔧 [응급 나노 수리] 선체 내구도가 +50 회복되었습니다 (${hull}/${maxHull}).`;
        break;
      case 'item_fuel_cell':
        fuel = Math.min(maxFuel, fuel + 60);
        effectMessage = `⚡ [중수소 연료 충전] 연료가 +60 충전되었습니다 (${fuel}/${maxFuel}).`;
        break;
      case 'item_afterburner_chip':
        speedBonus = Number((speedBonus + 0.25).toFixed(2));
        fuel = Math.min(maxFuel, fuel + 20);
        effectMessage = `🚀 [애프터버너 장착] 직접 운행 최고 속도가 +25% 증가했습니다 (현재 배율: ${(speedBonus * 100).toFixed(0)}%)!`;
        break;
      case 'item_mining_drone':
        laserLv += 1;
        effectMessage = `⛏️ [채굴 드론 배치] 채굴 레이저 등급이 Lv.${laserLv}로 상승했습니다!`;
        break;
      case 'item_cargo_pod':
        cargoCap += 30;
        effectMessage = `📦 [자력 화물 컨테이너] 최대 화물칸 용량이 ${cargoCap}으로 +30 확장되었습니다!`;
        break;
      case 'item_shield_booster':
        shieldLv += 1;
        maxHull += 35;
        hull = Math.min(maxHull, hull + 35);
        effectMessage = `🛡️ [이이지스 실드 증폭] 실드 Lv.${shieldLv} 달성 및 최대 선체 내구도가 ${maxHull}로 증가했습니다!`;
        break;
      case 'item_pirate_jammer':
        shieldLv += 1;
        speedBonus = Number((speedBonus + 0.15).toFixed(2));
        effectMessage = `📡 [스텔스 재머 가동] 실드 Lv.${shieldLv} 상승 및 직접 운행 기동성이 +15% 향상되었습니다!`;
        break;
      case 'item_trade_license':
        reputation += 60;
        cargoCap += 25;
        effectMessage = `📜 [헤르메스 면세 인장] 성간 평판 +60 상승 및 화물칸 용량이 +25 확장되었습니다!`;
        break;
      case 'item_warp_stabilizer':
        warpLv += 1;
        maxFuel += 50;
        fuel = Math.min(maxFuel, fuel + 50);
        effectMessage = `🌀 [타키온 워프 안정기] 워프 드라이브 Lv.${warpLv} 달성 및 최대 연료통이 ${maxFuel}로 확장되었습니다!`;
        break;
      case 'item_deep_scanner': {
        laserLv += 1;
        const durMs = 1800 * 1000;
        for (let i = 0; i < 3; i++) {
          const sec = ALL_SECTORS[(Date.now() + i * 3) % ALL_SECTORS.length];
          unlockedMaps[sec] = Math.max(nowMs, unlockedMaps[sec] || 0) + durMs;
        }
        effectMessage = `📡 [아카식 광맥 스캐너] 3개 구역 우주지도가 30분간 해금되고 채굴 레이저가 Lv.${laserLv}로 강화되었습니다!`;
        break;
      }
      case 'item_valkyrie_thruster':
        speedBonus = Number((speedBonus + 0.5).toFixed(2));
        maxFuel += 60;
        fuel = maxFuel;
        effectMessage = `🔥 [발키리 오버드라이브] 직접 운행 속도 +50% 증가(배율 ${(speedBonus * 100).toFixed(0)}%) 및 연료통 확장·완충 완료!`;
        break;
      case 'item_aegis_matrix':
        maxHull += 100;
        hull = maxHull;
        shieldLv += 1;
        effectMessage = `🔱 [포세이돈 불멸 장갑판] 최대 선체 내구도 +100(${maxHull}), 선체 100% 수리, 실드 Lv.${shieldLv} 달성!`;
        break;
      case 'item_midas_alchemizer':
        cargoCap += 40;
        cargo['res_grav'] = (cargo['res_grav'] || 0) + 8;
        cargo['res_aether'] = (cargo['res_aether'] || 0) + 10;
        effectMessage = `⚗️ [불카누스 연금술 코어] 화물칸 +40 확장 및 희귀 광물(그래비토늄 8개, 에테르 쿼츠 10개) 연성 완료!`;
        break;
      case 'item_chrono_relic': {
        const durMs = 7200 * 1000; // 2 hours
        for (const sec of ALL_SECTORS) {
          unlockedMaps[sec] = Math.max(nowMs, unlockedMaps[sec] || 0) + durMs;
        }
        unlockedMaps['ALL_GALAXY'] = Math.max(nowMs, unlockedMaps['ALL_GALAXY'] || 0) + durMs;
        warpLv += 1;
        laserLv += 1;
        shieldLv += 1;
        maxHull += 80;
        hull = maxHull;
        maxFuel += 80;
        fuel = maxFuel;
        speedBonus = Number((speedBonus + 0.4).toFixed(2));
        effectMessage = `👑 [크로노스의 시공 성유물 공명] 전 은하 우주지도 2시간 개방 + 전 함선 능력치 초월 강화 완료!`;
        break;
      }
      case 'item_ai_pilot_basic':
        aiAgentUses += 3;
        effectMessage = `🤖 [베이직 AI 에이전트] AI 자동 운행 횟수가 +3회 충전되었습니다 (총 ${aiAgentUses}회 보유)!`;
        break;
      case 'item_ai_pilot_pro':
        aiAgentUses += 8;
        speedBonus = Number((speedBonus + 0.1).toFixed(2));
        effectMessage = `🤖 [퀀텀 AI 에이전트 Pro] AI 자동 운행 +8회 충전(총 ${aiAgentUses}회) 및 추진 속도 +10% 증가!`;
        break;
      case 'item_warp_cell_1':
        warpTickets += 1;
        effectMessage = `⚡ [초공간 워프 셀] 워프 점프 가능 횟수가 +1회 충전되었습니다 (총 ${warpTickets}회 보유)!`;
        break;
      case 'item_warp_cell_3':
        warpTickets += 3;
        fuel = Math.min(maxFuel, fuel + 40);
        effectMessage = `⚡ [대용량 워프 코어 팩] 워프 점프 +3회 충전(총 ${warpTickets}회) 및 연료 +40 보충!`;
        break;
      case 'loot_pirate_scrap_core':
        laserLv += 1;
        fuel = Math.min(maxFuel, fuel + 50);
        effectMessage = `🏴‍☠️ [해적 비매품 전리품] 개조 과부하 동력코어 장착! 채굴 레이저 Lv.${laserLv} 상승 & 연료 +50!`;
        break;
      case 'loot_corsair_plasma_cannon':
        shieldLv += 1;
        laserLv += 1;
        maxHull += 40;
        hull = Math.min(maxHull, hull + 40);
        effectMessage = `🏴‍☠️ [해적 비매품 전리품] 코르세어 약탈 함포 장착! 실드 Lv.${shieldLv}, 무장 Lv.${laserLv}, 선체 +40!`;
        break;
      case 'loot_void_nav_blackbox': {
        warpTickets += 2;
        aiAgentUses += 4;
        const durMs = 1800 * 1000;
        for (let i = 0; i < 2; i++) {
          const sec = ALL_SECTORS[(Date.now() + i * 5) % ALL_SECTORS.length];
          unlockedMaps[sec] = Math.max(nowMs, unlockedMaps[sec] || 0) + durMs;
        }
        effectMessage = `🏴‍☠️ [해적 비매품 전리품] 암흑 항법 블랙박스 해독! 워프 티켓 +2, AI 자동운행 +4, 2개 구역 성도 해금!`;
        break;
      }
      case 'loot_dreadnought_singularity':
        speedBonus = Number((speedBonus + 0.45).toFixed(2));
        warpLv += 1;
        maxHull += 90;
        hull = maxHull;
        warpTickets += 2;
        effectMessage = `🏴‍☠️ [해적 비매품 전리품] 드레드노트 특이점 엔진 융합! 속도 +45%, 워프 Lv.${warpLv}, 선체 +90, 워프 티켓 +2!`;
        break;
      case 'loot_leviathan_crown': {
        const durMs = 7200 * 1000;
        for (const sec of ALL_SECTORS) {
          unlockedMaps[sec] = Math.max(nowMs, unlockedMaps[sec] || 0) + durMs;
        }
        unlockedMaps['ALL_GALAXY'] = Math.max(nowMs, unlockedMaps['ALL_GALAXY'] || 0) + durMs;
        warpTickets += 4;
        aiAgentUses += 6;
        warpLv += 2;
        laserLv += 2;
        shieldLv += 2;
        maxHull += 120;
        hull = maxHull;
        effectMessage = `👑 [해적황제 신화 전리품] 레비아탄의 심연 왕관 노획! 워프 +4, AI 운행 +6, 전 스탯 +2, 전 은하 성도 개방!`;
        break;
      }
      default:
        effectMessage = `[아이템 획득] ${item.name_ko} 적용 완료!`;
    }
  }

  await db.run(
    `UPDATE users SET
      hull = ?, max_hull = ?, fuel = ?, max_fuel = ?, cargo_capacity = ?,
      mining_laser_level = ?, warp_drive_level = ?, shield_level = ?,
      reputation = ?, flight_speed_bonus = ?, warp_tickets = ?, ai_agent_uses = ?,
      cargo_json = ?, inventory_json = ?, unlocked_maps_json = ?
     WHERE id = ?`,
    [
      hull,
      maxHull,
      fuel,
      maxFuel,
      cargoCap,
      laserLv,
      warpLv,
      shieldLv,
      reputation,
      speedBonus,
      warpTickets,
      aiAgentUses,
      JSON.stringify(cargo),
      JSON.stringify(inventory),
      JSON.stringify(unlockedMaps),
      user.id,
    ]
  );

  return { effectMessage };
}

/**
 * Rolls a level-appropriate loot item when a Space Pirate is defeated.
 * Higher pirate levels guarantee higher-tier Pirate-Exclusive (non-shop) Relics!
 */
export function rollPirateLootDrop(pirateLevel: number): ShopItemSpec {
  const pirateExclusivePool = SHOP_ITEMS.filter((it) => it.pirate_only);
  if (pirateLevel >= 8) {
    return pirateExclusivePool.find((i) => i.id === 'loot_leviathan_crown') || pirateExclusivePool[0];
  }
  if (pirateLevel >= 6) {
    return pirateExclusivePool.find((i) => i.id === 'loot_dreadnought_singularity') || pirateExclusivePool[0];
  }
  if (pirateLevel >= 4) {
    return pirateExclusivePool.find((i) => i.id === 'loot_void_nav_blackbox') || pirateExclusivePool[0];
  }
  if (pirateLevel >= 2) {
    return pirateExclusivePool.find((i) => i.id === 'loot_corsair_plasma_cannon') || pirateExclusivePool[0];
  }
  return pirateExclusivePool.find((i) => i.id === 'loot_pirate_scrap_core') || pirateExclusivePool[0];
}
