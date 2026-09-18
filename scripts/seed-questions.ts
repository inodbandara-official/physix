/**
 * Demonstration question bank: real Sri Lankan A/L Physics content across
 * every unit and every supported question type.
 *
 * `topic` matches a topic name seeded by `seedSyllabus()` in seed.ts. Values
 * are written the way a teacher would: g = 9.8 m s^-2 unless a question says
 * otherwise, tolerances set so a sensibly rounded answer still scores.
 */

export type SeedBody =
  | { kind: 'mcq'; options: string[]; correct: number }
  | { kind: 'multi'; options: string[]; correct: number[] }
  | { kind: 'true_false'; correct: boolean }
  | {
      kind: 'numerical';
      value: string;
      tolerance?: string;
      relative?: string;
      units?: string[];
      requireUnit?: boolean;
      sf?: number;
    }
  | { kind: 'short_answer'; answers: string[] }
  | { kind: 'essay'; rubric: string; words?: number }
  | {
      kind: 'structured';
      parts: {
        label: string;
        prompt: string;
        marks: number;
        body: Exclude<SeedBody, { kind: 'structured' }>;
        explanation?: string;
      }[];
    };

export interface SeedQuestion {
  code: string;
  topic: string;
  title: string;
  stem: string;
  marks: number;
  difficulty: 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';
  seconds: number;
  tags: string[];
  body: SeedBody;
  explanation?: string;
  solution?: string;
  hint?: string;
  commonMistake?: string;
  year?: number;
  paper?: string;
}

type NumericalSeed = Extract<SeedBody, { kind: 'numerical' }>;

const n = (value: string, extra: Omit<Partial<NumericalSeed>, 'kind' | 'value'> = {}): NumericalSeed => ({
  kind: 'numerical',
  value,
  ...extra,
});

export const SEED_QUESTIONS: SeedQuestion[] = [
  // ---------------------------------------------------------------- Measurement
  {
    code: 'Q-0001',
    topic: 'Physical Quantities and Units',
    title: 'Base quantities',
    stem: 'Which of the following is NOT a base quantity in the SI system?',
    marks: 1,
    difficulty: 'very_easy',
    seconds: 45,
    tags: ['measurement', 'concept'],
    body: { kind: 'mcq', options: ['Length', 'Mass', 'Force', 'Thermodynamic temperature'], correct: 2 },
    explanation: 'Force is a derived quantity: $F = ma$, with units $\\text{kg m s}^{-2}$.',
  },
  {
    code: 'Q-0002',
    topic: 'Physical Quantities and Units',
    title: 'Dimensions of pressure',
    stem: 'Write down the dimensions of pressure in terms of mass (M), length (L) and time (T).',
    marks: 2,
    difficulty: 'easy',
    seconds: 90,
    tags: ['measurement', 'dimensions'],
    body: { kind: 'short_answer', answers: ['ML^-1T^-2', 'M L^-1 T^-2', 'MLT^-2/L^2'] },
    explanation: 'Pressure is force per unit area: $\\dfrac{MLT^{-2}}{L^{2}} = ML^{-1}T^{-2}$.',
  },
  {
    code: 'Q-0003',
    topic: 'Physical Quantities and Units',
    title: 'Percentage uncertainty',
    stem: 'The length of a wire is measured as $(2.50 \\pm 0.02)\\ \\text{m}$. Calculate the percentage uncertainty in the length.',
    marks: 2,
    difficulty: 'easy',
    seconds: 90,
    tags: ['measurement', 'uncertainty', 'numerical'],
    body: n('0.8', { tolerance: '0.05', units: ['%'], sf: 1 }),
    solution: 'Percentage uncertainty $= \\dfrac{0.02}{2.50} \\times 100\\% = 0.8\\%$.',
  },
  {
    code: 'Q-0004',
    topic: 'Physical Quantities and Units',
    title: 'Random and systematic error',
    stem: 'Explain the difference between a random error and a systematic error in a Physics experiment. Give one example of each and state how the effect of each may be reduced.',
    marks: 6,
    difficulty: 'medium',
    seconds: 420,
    tags: ['measurement', 'written'],
    body: {
      kind: 'essay',
      words: 180,
      rubric:
        '1 mark — random errors vary unpredictably in size and sign between readings\n1 mark — systematic errors shift every reading by the same amount in the same direction\n1 mark — valid example of a random error (e.g. reaction time when timing by hand)\n1 mark — valid example of a systematic error (e.g. a zero error on a micrometer)\n1 mark — random error reduced by repeating and averaging\n1 mark — systematic error reduced by checking for zero error and calibrating the instrument',
    },
  },

  // ------------------------------------------------------------------- Motion
  {
    code: 'Q-0005',
    topic: 'Motion',
    title: 'Uniform acceleration from rest',
    stem: 'A body starts from rest and accelerates uniformly at $2.5\\ \\text{m s}^{-2}$ for $8.0\\ \\text{s}$.\n\nCalculate its final velocity.',
    marks: 2,
    difficulty: 'very_easy',
    seconds: 90,
    tags: ['mechanics', 'numerical'],
    body: n('20', { tolerance: '0.5', units: ['m s^-1', 'm/s', 'ms^-1'], requireUnit: true }),
    hint: 'Which equation of motion links $u$, $a$, $t$ and $v$?',
    solution: 'Using $v = u + at$ with $u = 0$:\n$$v = 0 + 2.5 \\times 8.0 = 20\\ \\text{m s}^{-1}$$',
  },
  {
    code: 'Q-0006',
    topic: 'Motion',
    title: 'Braking distance',
    stem: 'A car travelling at $25\\ \\text{m s}^{-1}$ is brought uniformly to rest in $5.0\\ \\text{s}$.\n\nCalculate the distance travelled while braking.',
    marks: 3,
    difficulty: 'easy',
    seconds: 120,
    tags: ['mechanics', 'numerical'],
    body: n('62.5', { tolerance: '0.5', units: ['m'], requireUnit: true }),
    solution: 'With uniform deceleration the average velocity is $\\dfrac{u+v}{2}$:\n$$s = \\frac{25 + 0}{2} \\times 5.0 = 62.5\\ \\text{m}$$',
    commonMistake: 'Using $s = ut$ and forgetting that the car is slowing down.',
  },
  {
    code: 'Q-0007',
    topic: 'Motion',
    title: 'At the top of the flight',
    stem: 'A ball is thrown vertically upwards. At the highest point of its flight, which statement is correct? Air resistance is negligible.',
    marks: 1,
    difficulty: 'easy',
    seconds: 60,
    tags: ['mechanics', 'concept'],
    body: {
      kind: 'mcq',
      options: [
        'Both the velocity and the acceleration are zero.',
        'The velocity is zero and the acceleration is $9.8\\ \\text{m s}^{-2}$ downwards.',
        'The velocity is zero and the acceleration is $9.8\\ \\text{m s}^{-2}$ upwards.',
        'The velocity is maximum and the acceleration is zero.',
      ],
      correct: 1,
    },
    explanation:
      'Gravity acts throughout the flight, so the acceleration is always $9.8\\ \\text{m s}^{-2}$ downwards. Only the velocity is momentarily zero.',
    commonMistake: 'Assuming that zero velocity means zero acceleration.',
  },
  {
    code: 'Q-0008',
    topic: 'Motion',
    title: 'Projectile — maximum height',
    stem: 'A projectile is launched with a speed of $20\\ \\text{m s}^{-1}$ at $30°$ to the horizontal. Take $g = 9.8\\ \\text{m s}^{-2}$ and neglect air resistance.\n\nCalculate the maximum height reached.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['mechanics', 'projectile', 'numerical'],
    body: n('5.1', { tolerance: '0.15', units: ['m'], requireUnit: true }),
    solution:
      'Vertical component: $u_y = 20\\sin 30° = 10\\ \\text{m s}^{-1}$.\n$$H = \\frac{u_y^2}{2g} = \\frac{10^2}{2 \\times 9.8} = 5.1\\ \\text{m}$$',
  },
  {
    code: 'Q-0009',
    topic: 'Motion',
    title: 'Projectile — horizontal range',
    stem: 'For the same projectile launched at $20\\ \\text{m s}^{-1}$ at $30°$ to the horizontal, calculate the horizontal range on level ground.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['mechanics', 'projectile', 'numerical'],
    body: n('35.3', { tolerance: '0.5', units: ['m'], requireUnit: true }),
    solution: '$$R = \\frac{u^2 \\sin 2\\theta}{g} = \\frac{20^2 \\times \\sin 60°}{9.8} = 35.3\\ \\text{m}$$',
  },
  {
    code: 'Q-0010',
    topic: 'Motion',
    title: 'Constant acceleration — three parts',
    stem: 'A particle starts from rest and moves in a straight line with constant acceleration. After $4.0\\ \\text{s}$ its velocity is $10\\ \\text{m s}^{-1}$.',
    marks: 8,
    difficulty: 'medium',
    seconds: 420,
    tags: ['mechanics', 'structured'],
    body: {
      kind: 'structured',
      parts: [
        {
          label: 'a',
          prompt: 'Calculate the acceleration of the particle.',
          marks: 2,
          body: n('2.5', { tolerance: '0.05', units: ['m s^-2', 'm/s^2'], requireUnit: true }),
          explanation: '$a = \\dfrac{v-u}{t} = \\dfrac{10-0}{4.0} = 2.5\\ \\text{m s}^{-2}$',
        },
        {
          label: 'b',
          prompt: 'Calculate the distance travelled in the first $4.0\\ \\text{s}$.',
          marks: 3,
          body: n('20', { tolerance: '0.5', units: ['m'], requireUnit: true }),
          explanation: '$s = ut + \\tfrac{1}{2}at^2 = 0 + \\tfrac{1}{2}(2.5)(4.0)^2 = 20\\ \\text{m}$',
        },
        {
          label: 'c',
          prompt: 'State one assumption you have made in parts (a) and (b).',
          marks: 3,
          body: {
            kind: 'essay',
            rubric:
              '3 marks — states that the acceleration is uniform throughout, and that the motion is in a straight line with no resistive forces considered',
          },
        },
      ],
    },
  },

  // ------------------------------------------------------------ Newton's Laws
  {
    code: 'Q-0011',
    topic: "Newton's Laws",
    title: 'Resultant force',
    stem: 'A resultant force acts on a body of mass $2.0\\ \\text{kg}$, giving it an acceleration of $3.0\\ \\text{m s}^{-2}$.\n\nCalculate the magnitude of the resultant force.',
    marks: 2,
    difficulty: 'very_easy',
    seconds: 60,
    tags: ['mechanics', 'numerical'],
    body: n('6', { tolerance: '0.1', units: ['N'], requireUnit: true }),
    solution: '$$F = ma = 2.0 \\times 3.0 = 6.0\\ \\text{N}$$',
  },
  {
    code: 'Q-0012',
    topic: "Newton's Laws",
    title: 'Impulse on a rebounding ball',
    stem: 'A ball of mass $0.15\\ \\text{kg}$ strikes a wall horizontally at $20\\ \\text{m s}^{-1}$ and rebounds along the same line at $15\\ \\text{m s}^{-1}$.\n\nCalculate the magnitude of the impulse exerted on the ball.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['mechanics', 'momentum', 'numerical'],
    body: n('5.25', { tolerance: '0.1', units: ['N s', 'kg m s^-1'], requireUnit: true }),
    solution:
      'Taking the initial direction as positive, the final velocity is $-15\\ \\text{m s}^{-1}$:\n$$J = m(v-u) = 0.15 \\times (-15 - 20) = -5.25\\ \\text{N s}$$\nThe magnitude is $5.25\\ \\text{N s}$.',
    commonMistake: 'Using $0.15 \\times (20 - 15) = 0.75$, which ignores the reversal of direction.',
  },
  {
    code: 'Q-0013',
    topic: "Newton's Laws",
    title: 'Third-law pairs',
    stem: 'A book rests on a table. Which pair of forces is a Newton\u2019s third law pair?',
    marks: 1,
    difficulty: 'hard',
    seconds: 90,
    tags: ['mechanics', 'concept'],
    body: {
      kind: 'mcq',
      options: [
        'The weight of the book and the normal force from the table on the book.',
        'The normal force from the table on the book and the force of the book on the table.',
        'The weight of the book and the weight of the table.',
        'The normal force on the book and the weight of the table.',
      ],
      correct: 1,
    },
    explanation:
      'A third-law pair acts on two different bodies, is of the same type, and is equal and opposite. The weight and the normal force both act on the book, so they are not a pair — they merely balance.',
  },
  {
    code: 'Q-0014',
    topic: 'Friction',
    title: 'Limiting friction',
    stem: 'A block of mass $5.0\\ \\text{kg}$ rests on a horizontal surface with coefficient of static friction $0.40$. Take $g = 9.8\\ \\text{m s}^{-2}$.\n\nCalculate the maximum frictional force before the block begins to slide.',
    marks: 2,
    difficulty: 'easy',
    seconds: 120,
    tags: ['mechanics', 'friction', 'numerical'],
    body: n('19.6', { tolerance: '0.3', units: ['N'], requireUnit: true }),
    solution: '$$f_{max} = \\mu R = \\mu mg = 0.40 \\times 5.0 \\times 9.8 = 19.6\\ \\text{N}$$',
  },
  {
    code: 'Q-0015',
    topic: 'Connected Bodies',
    title: 'Masses over a pulley',
    stem: 'Two masses of $3.0\\ \\text{kg}$ and $5.0\\ \\text{kg}$ hang from a light inextensible string over a smooth pulley. Take $g = 9.8\\ \\text{m s}^{-2}$.\n\nCalculate the acceleration of the system.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['mechanics', 'numerical'],
    body: n('2.45', { tolerance: '0.05', units: ['m s^-2', 'm/s^2'], requireUnit: true }),
    solution:
      '$$a = \\frac{(m_2 - m_1)g}{m_1 + m_2} = \\frac{(5.0-3.0) \\times 9.8}{8.0} = 2.45\\ \\text{m s}^{-2}$$',
  },

  // -------------------------------------------------------- Work, Energy, Power
  {
    code: 'Q-0016',
    topic: 'Work, Energy and Power',
    title: 'Kinetic energy',
    stem: 'A body of mass $2\\ \\text{kg}$ is moving at $5\\ \\text{m s}^{-1}$.\n\nCalculate its kinetic energy.',
    marks: 2,
    difficulty: 'very_easy',
    seconds: 60,
    tags: ['mechanics', 'energy', 'numerical'],
    body: n('25', { tolerance: '0.5', units: ['J'], requireUnit: true }),
    solution: '$$E_k = \\tfrac{1}{2}mv^2 = \\tfrac{1}{2} \\times 2 \\times 5^2 = 25\\ \\text{J}$$',
    commonMistake: 'Forgetting to square the velocity.',
  },
  {
    code: 'Q-0017',
    topic: 'Work, Energy and Power',
    title: 'Work done at an angle',
    stem: 'A force of $50\\ \\text{N}$ pulls a crate $4.0\\ \\text{m}$ along a horizontal floor. The force acts at $60°$ to the direction of motion.\n\nCalculate the work done by the force.',
    marks: 3,
    difficulty: 'easy',
    seconds: 120,
    tags: ['mechanics', 'energy', 'numerical'],
    body: n('100', { tolerance: '2', units: ['J'], requireUnit: true }),
    solution: '$$W = Fs\\cos\\theta = 50 \\times 4.0 \\times \\cos 60° = 100\\ \\text{J}$$',
  },
  {
    code: 'Q-0018',
    topic: 'Work, Energy and Power',
    title: 'Power of a pump',
    stem: 'A pump raises $200\\ \\text{kg}$ of water through a height of $15\\ \\text{m}$ every minute. Take $g = 9.8\\ \\text{m s}^{-2}$.\n\nCalculate the useful output power of the pump.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['mechanics', 'energy', 'numerical'],
    body: n('490', { tolerance: '5', units: ['W'], requireUnit: true }),
    solution:
      'Work done per minute $= mgh = 200 \\times 9.8 \\times 15 = 29\\,400\\ \\text{J}$.\n$$P = \\frac{29400}{60} = 490\\ \\text{W}$$',
  },
  {
    code: 'Q-0019',
    topic: 'Conservation of Energy',
    title: 'Speed on landing',
    stem: 'An object is released from rest at a height of $20\\ \\text{m}$ above the ground. Take $g = 9.8\\ \\text{m s}^{-2}$ and neglect air resistance.\n\nCalculate its speed just before it hits the ground.',
    marks: 3,
    difficulty: 'easy',
    seconds: 150,
    tags: ['mechanics', 'energy', 'numerical'],
    body: n('19.8', { tolerance: '0.2', units: ['m s^-1', 'm/s'], requireUnit: true }),
    solution:
      'Formula:\n$$v^2 = u^2 + 2as$$\nSubstitute:\n$$v^2 = 0^2 + 2 \\times 9.8 \\times 20$$\nTherefore $v = 19.8\\ \\text{m s}^{-1}$.',
  },
  {
    code: 'Q-0020',
    topic: 'Work, Energy and Power',
    title: 'Work done by a centripetal force',
    stem: 'The work done by the centripetal force on a body moving in a circle at constant speed is zero.',
    marks: 1,
    difficulty: 'medium',
    seconds: 60,
    tags: ['mechanics', 'concept'],
    body: { kind: 'true_false', correct: true },
    explanation:
      'The centripetal force is always perpendicular to the velocity, so $W = Fs\\cos 90° = 0$. This is why the speed does not change.',
  },

  // ------------------------------------------------------------ Circular Motion
  {
    code: 'Q-0021',
    topic: 'Circular Motion',
    title: 'Centripetal force',
    stem: 'A body of mass $0.50\\ \\text{kg}$ moves in a horizontal circle of radius $2.0\\ \\text{m}$ at a constant speed of $4.0\\ \\text{m s}^{-1}$.\n\nCalculate the centripetal force acting on it.',
    marks: 2,
    difficulty: 'easy',
    seconds: 120,
    tags: ['mechanics', 'circular-motion', 'numerical'],
    body: n('4', { tolerance: '0.1', units: ['N'], requireUnit: true }),
    solution: '$$F = \\frac{mv^2}{r} = \\frac{0.50 \\times 4.0^2}{2.0} = 4.0\\ \\text{N}$$',
  },
  {
    code: 'Q-0022',
    topic: 'Circular Motion',
    title: 'Banking angle',
    stem: 'A road of radius $50\\ \\text{m}$ is banked so that a vehicle travelling at $20\\ \\text{m s}^{-1}$ needs no friction to go round the bend. Take $g = 9.8\\ \\text{m s}^{-2}$.\n\nCalculate the angle of banking.',
    marks: 4,
    difficulty: 'hard',
    seconds: 240,
    tags: ['mechanics', 'circular-motion', 'numerical'],
    body: n('39.2', { tolerance: '0.5', units: ['°', 'degrees', 'deg'] }),
    solution:
      '$$\\tan\\theta = \\frac{v^2}{rg} = \\frac{20^2}{50 \\times 9.8} = 0.8163$$\n$$\\theta = \\tan^{-1}(0.8163) = 39.2°$$',
  },

  // -------------------------------------------------------- Gravitational Fields
  {
    code: 'Q-0023',
    topic: 'Gravitational Fields',
    title: 'Newton\u2019s law of gravitation',
    stem: 'Two point masses of $1.0 \\times 10^{3}\\ \\text{kg}$ and $2.0 \\times 10^{3}\\ \\text{kg}$ are $10\\ \\text{m}$ apart. Take $G = 6.67 \\times 10^{-11}\\ \\text{N m}^{2}\\ \\text{kg}^{-2}$.\n\nCalculate the gravitational force between them.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['mechanics', 'gravitation', 'numerical'],
    body: n('1.334e-6', { relative: '0.02', units: ['N'], requireUnit: true }),
    solution:
      '$$F = \\frac{Gm_1m_2}{r^2} = \\frac{6.67\\times10^{-11} \\times 1.0\\times10^{3} \\times 2.0\\times10^{3}}{10^2} = 1.33 \\times 10^{-6}\\ \\text{N}$$',
  },
  {
    code: 'Q-0024',
    topic: 'Gravitational Fields',
    title: 'Orbital speed of a satellite',
    stem: 'A satellite orbits the Earth in a circular orbit of radius $7.0 \\times 10^{6}\\ \\text{m}$ from the centre of the Earth. Take $GM = 3.99 \\times 10^{14}\\ \\text{N m}^{2}\\ \\text{kg}^{-1}$.\n\nCalculate its orbital speed.',
    marks: 4,
    difficulty: 'hard',
    seconds: 240,
    tags: ['mechanics', 'gravitation', 'numerical'],
    body: n('7550', { relative: '0.02', units: ['m s^-1', 'm/s'], requireUnit: true }),
    solution:
      'The gravitational force provides the centripetal force:\n$$\\frac{GMm}{r^2} = \\frac{mv^2}{r} \\implies v = \\sqrt{\\frac{GM}{r}}$$\n$$v = \\sqrt{\\frac{3.99\\times10^{14}}{7.0\\times10^{6}}} = 7.55 \\times 10^{3}\\ \\text{m s}^{-1}$$',
  },

  // ------------------------------------------------- Simple Harmonic Motion
  {
    code: 'Q-0025',
    topic: 'Simple Harmonic Motion',
    title: 'Period of a simple pendulum',
    stem: 'A simple pendulum has a length of $1.00\\ \\text{m}$. Take $g = 9.8\\ \\text{m s}^{-2}$.\n\nCalculate its period of oscillation.',
    marks: 3,
    difficulty: 'easy',
    seconds: 150,
    tags: ['shm', 'numerical'],
    body: n('2.0', { tolerance: '0.05', units: ['s'], requireUnit: true }),
    solution: '$$T = 2\\pi\\sqrt{\\frac{l}{g}} = 2\\pi\\sqrt{\\frac{1.00}{9.8}} = 2.0\\ \\text{s}$$',
  },
  {
    code: 'Q-0026',
    topic: 'Simple Harmonic Motion',
    title: 'Mass on a spring',
    stem: 'A mass of $0.20\\ \\text{kg}$ oscillates on a spring of force constant $50\\ \\text{N m}^{-1}$.\n\nCalculate the period of oscillation.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['shm', 'numerical'],
    body: n('0.397', { tolerance: '0.01', units: ['s'], requireUnit: true }),
    solution: '$$T = 2\\pi\\sqrt{\\frac{m}{k}} = 2\\pi\\sqrt{\\frac{0.20}{50}} = 0.397\\ \\text{s}$$',
  },
  {
    code: 'Q-0027',
    topic: 'Simple Harmonic Motion',
    title: 'Defining condition for SHM',
    stem: 'For a body executing simple harmonic motion, which statement about the acceleration is correct?',
    marks: 1,
    difficulty: 'easy',
    seconds: 60,
    tags: ['shm', 'concept'],
    body: {
      kind: 'mcq',
      options: [
        'It is constant in magnitude and direction.',
        'It is proportional to the displacement and in the same direction.',
        'It is proportional to the displacement and directed towards the equilibrium position.',
        'It is proportional to the velocity and directed towards the equilibrium position.',
      ],
      correct: 2,
    },
    explanation: 'The defining relation is $a = -\\omega^2 x$: the minus sign is the restoring direction.',
  },

  // -------------------------------------------------------------- Wave Motion
  {
    code: 'Q-0028',
    topic: 'Wave Motion',
    title: 'Wave equation',
    stem: 'A sound wave of frequency $500\\ \\text{Hz}$ has a wavelength of $0.68\\ \\text{m}$.\n\nCalculate the speed of the wave.',
    marks: 2,
    difficulty: 'very_easy',
    seconds: 90,
    tags: ['waves', 'numerical'],
    body: n('340', { tolerance: '2', units: ['m s^-1', 'm/s'], requireUnit: true }),
    solution: '$$v = f\\lambda = 500 \\times 0.68 = 340\\ \\text{m s}^{-1}$$',
  },
  {
    code: 'Q-0029',
    topic: 'Wave Motion',
    title: 'Fundamental frequency of a string',
    stem: 'A stretched string of length $0.50\\ \\text{m}$ is fixed at both ends. The speed of transverse waves on the string is $200\\ \\text{m s}^{-1}$.\n\nCalculate the fundamental frequency.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['waves', 'stationary-waves', 'numerical'],
    body: n('200', { tolerance: '2', units: ['Hz'], requireUnit: true }),
    solution:
      'In the fundamental mode the string carries half a wavelength, so $\\lambda = 2L = 1.0\\ \\text{m}$.\n$$f = \\frac{v}{\\lambda} = \\frac{200}{1.0} = 200\\ \\text{Hz}$$',
  },
  {
    code: 'Q-0030',
    topic: 'Wave Motion',
    title: 'Closed pipe fundamental',
    stem: 'A pipe closed at one end has a length of $0.25\\ \\text{m}$. The speed of sound in air is $340\\ \\text{m s}^{-1}$.\n\nCalculate the fundamental frequency of the air column.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['waves', 'sound', 'numerical'],
    body: n('340', { tolerance: '5', units: ['Hz'], requireUnit: true }),
    solution:
      'For a closed pipe the fundamental has $\\lambda = 4L = 1.0\\ \\text{m}$.\n$$f = \\frac{v}{\\lambda} = \\frac{340}{1.0} = 340\\ \\text{Hz}$$',
    commonMistake: 'Using $\\lambda = 2L$, which applies to a pipe open at both ends.',
  },
  {
    code: 'Q-0031',
    topic: 'Wave Motion',
    title: 'Longitudinal and transverse waves',
    stem: 'Which of the following are longitudinal waves? Select all that apply.',
    marks: 2,
    difficulty: 'easy',
    seconds: 90,
    tags: ['waves', 'concept'],
    body: {
      kind: 'multi',
      options: ['Sound waves in air', 'Light waves', 'Waves on a stretched string', 'Compression waves in a spring'],
      correct: [0, 3],
    },
    explanation:
      'In a longitudinal wave the oscillation is along the direction of travel. Light and waves on a string are transverse.',
  },

  // ------------------------------------------------ Interference and Diffraction
  {
    code: 'Q-0032',
    topic: 'Interference and Diffraction',
    title: 'Young\u2019s double slit spacing',
    stem: 'In a Young\u2019s double slit experiment, light of wavelength $600\\ \\text{nm}$ falls on slits $0.50\\ \\text{mm}$ apart. The screen is $2.0\\ \\text{m}$ away.\n\nCalculate the fringe separation on the screen.',
    marks: 3,
    difficulty: 'medium',
    seconds: 210,
    tags: ['waves', 'interference', 'numerical'],
    body: n('2.4e-3', { relative: '0.03', units: ['m'], requireUnit: true }),
    solution:
      '$$y = \\frac{\\lambda D}{d} = \\frac{600\\times10^{-9} \\times 2.0}{0.50\\times10^{-3}} = 2.4 \\times 10^{-3}\\ \\text{m}$$',
    commonMistake: 'Leaving the slit separation in millimetres.',
  },
  {
    code: 'Q-0033',
    topic: 'Interference and Diffraction',
    title: 'Diffraction grating angle',
    stem: 'A diffraction grating has $600$ lines per millimetre. Light of wavelength $589\\ \\text{nm}$ falls normally on it.\n\nCalculate the angle of the first-order maximum.',
    marks: 4,
    difficulty: 'hard',
    seconds: 300,
    tags: ['waves', 'diffraction', 'numerical'],
    body: n('20.7', { tolerance: '0.5', units: ['°', 'degrees', 'deg'] }),
    solution:
      'Grating spacing $d = \\dfrac{1\\times10^{-3}}{600} = 1.667 \\times 10^{-6}\\ \\text{m}$.\n$$\\sin\\theta = \\frac{n\\lambda}{d} = \\frac{589\\times10^{-9}}{1.667\\times10^{-6}} = 0.3534$$\n$$\\theta = 20.7°$$',
  },
  {
    code: 'Q-0034',
    topic: 'Interference and Diffraction',
    title: 'Conditions for observable interference',
    stem: 'Which conditions must be satisfied for a stable interference pattern to be observed? Select all that apply.',
    marks: 3,
    difficulty: 'medium',
    seconds: 150,
    tags: ['waves', 'interference', 'concept'],
    body: {
      kind: 'multi',
      options: [
        'The two sources must be coherent.',
        'The two sources must have equal or nearly equal amplitudes.',
        'The two sources must have the same frequency.',
        'The two sources must be exactly in phase.',
      ],
      correct: [0, 1, 2],
    },
    explanation:
      'A constant phase difference is enough — the sources need not be exactly in phase. Equal amplitudes give the best contrast.',
  },

  // ---------------------------------------------------------- Thermal Physics
  {
    code: 'Q-0035',
    topic: 'Heat and Temperature',
    title: 'Linear expansion',
    stem: 'A steel rod of length $2.00\\ \\text{m}$ is heated through $50\\ \\text{K}$. The coefficient of linear expansion of steel is $1.2 \\times 10^{-5}\\ \\text{K}^{-1}$.\n\nCalculate the increase in length.',
    marks: 3,
    difficulty: 'easy',
    seconds: 150,
    tags: ['thermal', 'numerical'],
    body: n('1.2e-3', { relative: '0.03', units: ['m'], requireUnit: true }),
    solution: '$$\\Delta l = l\\alpha\\Delta T = 2.00 \\times 1.2\\times10^{-5} \\times 50 = 1.2 \\times 10^{-3}\\ \\text{m}$$',
  },
  {
    code: 'Q-0036',
    topic: 'Heat and Temperature',
    title: 'Heating water',
    stem: 'Calculate the heat energy needed to raise the temperature of $0.50\\ \\text{kg}$ of water by $20\\ \\text{K}$. The specific heat capacity of water is $4200\\ \\text{J kg}^{-1}\\ \\text{K}^{-1}$.',
    marks: 2,
    difficulty: 'very_easy',
    seconds: 90,
    tags: ['thermal', 'numerical'],
    body: n('42000', { tolerance: '200', units: ['J'], requireUnit: true }),
    solution: '$$Q = mc\\Delta T = 0.50 \\times 4200 \\times 20 = 42\\,000\\ \\text{J}$$',
  },
  {
    code: 'Q-0037',
    topic: 'Gas Laws',
    title: 'Ideal gas equation',
    stem: 'Two moles of an ideal gas occupy a volume of $0.050\\ \\text{m}^{3}$ at a temperature of $300\\ \\text{K}$. Take $R = 8.31\\ \\text{J mol}^{-1}\\ \\text{K}^{-1}$.\n\nCalculate the pressure of the gas.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['thermal', 'gas-laws', 'numerical'],
    body: n('9.97e4', { relative: '0.02', units: ['Pa', 'N m^-2'], requireUnit: true }),
    solution: '$$p = \\frac{nRT}{V} = \\frac{2 \\times 8.31 \\times 300}{0.050} = 9.97 \\times 10^{4}\\ \\text{Pa}$$',
  },
  {
    code: 'Q-0038',
    topic: 'Gas Laws',
    title: 'Kinetic theory and temperature',
    stem: 'According to the kinetic theory of gases, the mean kinetic energy of the molecules of an ideal gas is proportional to',
    marks: 1,
    difficulty: 'easy',
    seconds: 60,
    tags: ['thermal', 'concept'],
    body: {
      kind: 'mcq',
      options: [
        'the pressure of the gas.',
        'the absolute temperature of the gas.',
        'the volume of the gas.',
        'the Celsius temperature of the gas.',
      ],
      correct: 1,
    },
    explanation: 'Mean translational kinetic energy $= \\tfrac{3}{2}kT$, where $T$ is the absolute temperature.',
  },
  {
    code: 'Q-0039',
    topic: 'Heat Transfer',
    title: 'Heat transfer without a medium',
    stem: 'Name the mode of heat transfer that does not require a material medium.',
    marks: 1,
    difficulty: 'very_easy',
    seconds: 45,
    tags: ['thermal', 'concept'],
    body: { kind: 'short_answer', answers: ['radiation', 'thermal radiation'] },
    explanation: 'Radiation travels as electromagnetic waves and so passes through a vacuum.',
  },
  {
    code: 'Q-0040',
    topic: 'Heat Transfer',
    title: 'Conduction in metals',
    stem: 'In a metal, heat conduction occurs mainly through the movement of free electrons.',
    marks: 1,
    difficulty: 'medium',
    seconds: 45,
    tags: ['thermal', 'concept'],
    body: { kind: 'true_false', correct: true },
    explanation:
      'Lattice vibrations also carry heat, but in a metal the free-electron contribution dominates — which is why good electrical conductors are also good thermal conductors.',
  },

  // ------------------------------------------------------------------- Optics
  {
    code: 'Q-0041',
    topic: 'Reflection and Refraction',
    title: 'Critical angle',
    stem: 'A material has a refractive index of $1.50$.\n\nCalculate the critical angle for light passing from this material into air.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['optics', 'numerical'],
    body: n('41.8', { tolerance: '0.5', units: ['°', 'degrees', 'deg'] }),
    solution: '$$\\sin C = \\frac{1}{n} = \\frac{1}{1.50} = 0.6667 \\implies C = 41.8°$$',
  },
  {
    code: 'Q-0042',
    topic: 'Reflection and Refraction',
    title: 'Image distance for a converging lens',
    stem: 'An object is placed $30\\ \\text{cm}$ from a converging lens of focal length $20\\ \\text{cm}$.\n\nCalculate the distance of the image from the lens.',
    marks: 3,
    difficulty: 'medium',
    seconds: 210,
    tags: ['optics', 'lenses', 'numerical'],
    body: n('60', { tolerance: '1', units: ['cm'], requireUnit: true }),
    solution:
      'Using $\\dfrac{1}{v} - \\dfrac{1}{u} = \\dfrac{1}{f}$ with $u = -30\\ \\text{cm}$ and $f = +20\\ \\text{cm}$:\n$$\\frac{1}{v} = \\frac{1}{20} - \\frac{1}{30} = \\frac{1}{60} \\implies v = 60\\ \\text{cm}$$',
  },
  {
    code: 'Q-0043',
    topic: 'Optical Instruments',
    title: 'Telescope magnification',
    stem: 'For an astronomical telescope in normal adjustment, the angular magnification is given by',
    marks: 1,
    difficulty: 'easy',
    seconds: 60,
    tags: ['optics', 'concept'],
    body: {
      kind: 'mcq',
      options: [
        '$f_o / f_e$, where $f_o$ is the focal length of the objective.',
        '$f_e / f_o$, where $f_e$ is the focal length of the eyepiece.',
        '$f_o \\times f_e$',
        '$f_o + f_e$',
      ],
      correct: 0,
    },
    explanation:
      'A long-focus objective and a short-focus eyepiece give high magnification; the tube length is then $f_o + f_e$.',
  },

  // --------------------------------------------------- Electricity and Magnetism
  {
    code: 'Q-0044',
    topic: 'Electric Fields',
    title: 'Coulomb force',
    stem: 'Two point charges of $+2.0\\ \\mu\\text{C}$ and $+3.0\\ \\mu\\text{C}$ are $0.10\\ \\text{m}$ apart in a vacuum. Take $\\dfrac{1}{4\\pi\\varepsilon_0} = 9.0 \\times 10^{9}\\ \\text{N m}^{2}\\ \\text{C}^{-2}$.\n\nCalculate the force between them.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['electricity', 'numerical'],
    body: n('5.4', { tolerance: '0.1', units: ['N'], requireUnit: true }),
    solution:
      '$$F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1q_2}{r^2} = \\frac{9.0\\times10^{9} \\times 2.0\\times10^{-6} \\times 3.0\\times10^{-6}}{0.10^2} = 5.4\\ \\text{N}$$',
  },
  {
    code: 'Q-0045',
    topic: 'Electric Fields',
    title: 'Capacitance from charge and voltage',
    stem: 'A capacitor stores a charge of $6.0\\ \\mu\\text{C}$ when the potential difference across it is $12\\ \\text{V}$.\n\nCalculate its capacitance.',
    marks: 2,
    difficulty: 'easy',
    seconds: 120,
    tags: ['electricity', 'numerical'],
    body: n('5.0e-7', { relative: '0.03', units: ['F'], requireUnit: true }),
    solution: '$$C = \\frac{Q}{V} = \\frac{6.0\\times10^{-6}}{12} = 5.0 \\times 10^{-7}\\ \\text{F} = 0.50\\ \\mu\\text{F}$$',
  },
  {
    code: 'Q-0046',
    topic: 'Current Electricity',
    title: 'Ohm\u2019s law',
    stem: 'A current of $0.50\\ \\text{A}$ flows through a resistor when the potential difference across it is $12\\ \\text{V}$.\n\nCalculate the resistance.',
    marks: 2,
    difficulty: 'very_easy',
    seconds: 60,
    tags: ['electricity', 'numerical'],
    body: n('24', { tolerance: '0.5', units: ['Ω', 'ohm', 'ohms'], requireUnit: true }),
    solution: '$$R = \\frac{V}{I} = \\frac{12}{0.50} = 24\\ \\Omega$$',
  },
  {
    code: 'Q-0047',
    topic: 'Current Electricity',
    title: 'Resistors and power',
    stem: 'Two resistors of $4.0\\ \\Omega$ and $6.0\\ \\Omega$ are connected in series across a $12\\ \\text{V}$ supply of negligible internal resistance.',
    marks: 7,
    difficulty: 'medium',
    seconds: 360,
    tags: ['electricity', 'structured'],
    body: {
      kind: 'structured',
      parts: [
        {
          label: 'a',
          prompt: 'Calculate the total resistance of the circuit.',
          marks: 2,
          body: n('10', { tolerance: '0.1', units: ['Ω', 'ohm', 'ohms'], requireUnit: true }),
          explanation: 'In series, $R = R_1 + R_2 = 4.0 + 6.0 = 10\\ \\Omega$.',
        },
        {
          label: 'b',
          prompt: 'Calculate the current in the circuit.',
          marks: 2,
          body: n('1.2', { tolerance: '0.05', units: ['A'], requireUnit: true }),
          explanation: '$I = \\dfrac{V}{R} = \\dfrac{12}{10} = 1.2\\ \\text{A}$',
        },
        {
          label: 'c',
          prompt: 'Calculate the power dissipated in the $6.0\\ \\Omega$ resistor.',
          marks: 3,
          body: n('8.64', { tolerance: '0.1', units: ['W'], requireUnit: true }),
          explanation: '$P = I^2R = 1.2^2 \\times 6.0 = 8.64\\ \\text{W}$',
        },
      ],
    },
  },
  {
    code: 'Q-0048',
    topic: 'Current Electricity',
    title: 'Why a potentiometer is preferred',
    stem: 'Explain why a potentiometer gives a more accurate measurement of the e.m.f. of a cell than a voltmeter connected directly across it.',
    marks: 4,
    difficulty: 'hard',
    seconds: 300,
    tags: ['electricity', 'written'],
    body: {
      kind: 'essay',
      words: 120,
      rubric:
        '1 mark — a voltmeter draws a current from the cell\n1 mark — so there is a lost volts drop across the internal resistance\n1 mark — the voltmeter therefore reads terminal p.d., not e.m.f.\n1 mark — at balance the potentiometer draws no current from the cell, so it measures the true e.m.f.',
    },
  },
  {
    code: 'Q-0049',
    topic: 'Magnetic Fields',
    title: 'Force on a current-carrying conductor',
    stem: 'A straight wire of length $0.40\\ \\text{m}$ carries a current of $5.0\\ \\text{A}$ at right angles to a uniform magnetic field of flux density $0.20\\ \\text{T}$.\n\nCalculate the force on the wire.',
    marks: 2,
    difficulty: 'easy',
    seconds: 120,
    tags: ['magnetism', 'numerical'],
    body: n('0.4', { tolerance: '0.02', units: ['N'], requireUnit: true }),
    solution: '$$F = BIL\\sin\\theta = 0.20 \\times 5.0 \\times 0.40 \\times \\sin 90° = 0.40\\ \\text{N}$$',
  },
  {
    code: 'Q-0050',
    topic: 'Magnetic Fields',
    title: 'Induced e.m.f.',
    stem: 'The magnetic flux through a coil of $200$ turns changes by $1.0 \\times 10^{-2}\\ \\text{Wb}$ in $0.50\\ \\text{s}$.\n\nCalculate the magnitude of the average induced e.m.f.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['magnetism', 'induction', 'numerical'],
    body: n('4', { tolerance: '0.1', units: ['V'], requireUnit: true }),
    solution:
      'By Faraday\u2019s law:\n$$|\\varepsilon| = N\\frac{\\Delta\\Phi}{\\Delta t} = 200 \\times \\frac{1.0\\times10^{-2}}{0.50} = 4.0\\ \\text{V}$$',
  },
  {
    code: 'Q-0051',
    topic: 'Alternating Current',
    title: 'R.m.s. voltage',
    stem: 'An alternating voltage has a peak value of $340\\ \\text{V}$.\n\nCalculate its root-mean-square value.',
    marks: 2,
    difficulty: 'easy',
    seconds: 120,
    tags: ['electricity', 'ac', 'numerical'],
    body: n('240', { tolerance: '2', units: ['V'], requireUnit: true }),
    solution: '$$V_{rms} = \\frac{V_0}{\\sqrt{2}} = \\frac{340}{1.414} = 240\\ \\text{V}$$',
  },
  {
    code: 'Q-0052',
    topic: 'Alternating Current',
    title: 'Transformer turns ratio',
    stem: 'An ideal transformer has $1000$ turns on its primary coil and is connected to a $240\\ \\text{V}$ supply. The output is $12\\ \\text{V}$.\n\nCalculate the number of turns on the secondary coil.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['electricity', 'ac', 'numerical'],
    body: n('50', { tolerance: '1' }),
    solution:
      '$$\\frac{N_s}{N_p} = \\frac{V_s}{V_p} \\implies N_s = 1000 \\times \\frac{12}{240} = 50$$',
  },

  // ---------------------------------------------------------- Modern Physics
  {
    code: 'Q-0053',
    topic: 'Photoelectric Effect',
    title: 'Maximum kinetic energy of photoelectrons',
    stem: 'Light of wavelength $400\\ \\text{nm}$ falls on a metal surface of work function $2.0\\ \\text{eV}$. Take $hc = 1240\\ \\text{eV nm}$.\n\nCalculate the maximum kinetic energy of the emitted photoelectrons, in eV.',
    marks: 4,
    difficulty: 'hard',
    seconds: 240,
    tags: ['modern-physics', 'numerical'],
    body: n('1.1', { tolerance: '0.05', units: ['eV'] }),
    solution:
      'Photon energy $E = \\dfrac{hc}{\\lambda} = \\dfrac{1240}{400} = 3.1\\ \\text{eV}$.\n$$E_{k(max)} = hf - \\phi = 3.1 - 2.0 = 1.1\\ \\text{eV}$$',
  },
  {
    code: 'Q-0054',
    topic: 'Photoelectric Effect',
    title: 'Effect of increasing intensity',
    stem: 'In a photoelectric experiment the intensity of the incident light is increased while its frequency is kept constant. Which statement is correct?',
    marks: 1,
    difficulty: 'medium',
    seconds: 90,
    tags: ['modern-physics', 'concept'],
    body: {
      kind: 'mcq',
      options: [
        'The maximum kinetic energy of the photoelectrons increases.',
        'The number of photoelectrons emitted per second increases.',
        'The threshold frequency decreases.',
        'No photoelectrons are emitted.',
      ],
      correct: 1,
    },
    explanation:
      'Intensity sets how many photons arrive, so it changes the current. The maximum kinetic energy depends only on the frequency.',
    commonMistake: 'Expecting brighter light to give faster electrons — a classical prediction the experiment disproves.',
  },
  {
    code: 'Q-0055',
    topic: 'Atomic and Nuclear Physics',
    title: 'Radioactive decay over three half-lives',
    stem: 'A radioactive isotope has a half-life of $8.0$ days.\n\nWhat percentage of the original number of nuclei remains after $24$ days?',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['modern-physics', 'nuclear', 'numerical'],
    body: n('12.5', { tolerance: '0.5', units: ['%'] }),
    solution:
      '$24$ days is three half-lives.\n$$\\frac{N}{N_0} = \\left(\\frac{1}{2}\\right)^{3} = \\frac{1}{8} = 12.5\\%$$',
  },
  {
    code: 'Q-0056',
    topic: 'Atomic and Nuclear Physics',
    title: 'Mass–energy equivalence',
    stem: 'In a nuclear reaction a mass of $1.0 \\times 10^{-3}\\ \\text{kg}$ is converted into energy. Take $c = 3.0 \\times 10^{8}\\ \\text{m s}^{-1}$.\n\nCalculate the energy released.',
    marks: 3,
    difficulty: 'medium',
    seconds: 180,
    tags: ['modern-physics', 'nuclear', 'numerical'],
    body: n('9.0e13', { relative: '0.02', units: ['J'], requireUnit: true }),
    solution: '$$E = mc^2 = 1.0\\times10^{-3} \\times (3.0\\times10^{8})^2 = 9.0 \\times 10^{13}\\ \\text{J}$$',
  },
  {
    code: 'Q-0057',
    topic: 'Atomic and Nuclear Physics',
    title: 'Nature of nuclear radiation',
    stem: 'Which of the following statements about alpha, beta and gamma radiation are correct? Select all that apply.',
    marks: 3,
    difficulty: 'medium',
    seconds: 150,
    tags: ['modern-physics', 'nuclear', 'concept'],
    body: {
      kind: 'multi',
      options: [
        'Alpha particles are the most strongly ionising of the three.',
        'Beta particles are deflected by a magnetic field.',
        'Gamma radiation is the most penetrating of the three.',
        'Gamma radiation is deflected by an electric field.',
      ],
      correct: [0, 1, 2],
    },
    explanation: 'Gamma radiation is uncharged electromagnetic radiation, so no field deflects it.',
  },
];
