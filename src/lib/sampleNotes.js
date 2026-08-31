// Canned sample decks shown on the upload-notes screen.
// Decks with an `items` array skip AI extraction so the terms stay exact.

const AMENDMENT_MEANINGS = [
  {
    term: 'First Amendment',
    definition:
      'Protects freedom of religion, speech, press, assembly, and the right to petition the government.',
    difficulty: 3,
    depends_on: [],
  },
  {
    term: 'Second Amendment',
    definition: 'Protects the right of the people to keep and bear arms.',
    difficulty: 3,
    depends_on: [],
  },
  {
    term: 'Third Amendment',
    definition:
      'Bars the government from forcing people to house soldiers in their homes in peacetime.',
    difficulty: 4,
    depends_on: [],
  },
  {
    term: 'Fourth Amendment',
    definition:
      'Protects against unreasonable searches and seizures and generally requires a warrant based on probable cause.',
    difficulty: 4,
    depends_on: [],
  },
  {
    term: 'Fifth Amendment',
    definition:
      'Protects against self-incrimination and double jeopardy, requires due process, and says the government must pay just compensation if it takes private property.',
    difficulty: 5,
    depends_on: [],
  },
  {
    term: 'Sixth Amendment',
    definition:
      'Guarantees a speedy, public trial by an impartial jury, the right to confront witnesses, and the right to a lawyer in criminal cases.',
    difficulty: 4,
    depends_on: [],
  },
  {
    term: 'Seventh Amendment',
    definition: 'Guarantees a jury trial in most federal civil (non-criminal) lawsuits.',
    difficulty: 5,
    depends_on: [],
  },
  {
    term: 'Eighth Amendment',
    definition: 'Bans excessive bail, excessive fines, and cruel and unusual punishment.',
    difficulty: 3,
    depends_on: [],
  },
  {
    term: 'Ninth Amendment',
    definition:
      'Says that listing certain rights in the Constitution does not mean people do not have other rights that are not written down.',
    difficulty: 6,
    depends_on: [],
  },
  {
    term: 'Tenth Amendment',
    definition:
      'Powers not given to the federal government, and not banned to the states, are reserved to the states or the people.',
    difficulty: 5,
    depends_on: [],
  },
];

const AMENDMENT_CASES = [
  {
    term: 'First Amendment — Tinker v. Des Moines',
    definition:
      '1969: Students do not lose free-speech rights at school; wearing black armbands to protest the Vietnam War was protected symbolic speech.',
    difficulty: 6,
    depends_on: ['First Amendment'],
  },
  {
    term: 'Second Amendment — District of Columbia v. Heller',
    definition:
      '2008: The Second Amendment protects an individual right to keep a handgun at home for self-defense, separate from militia service.',
    difficulty: 7,
    depends_on: ['Second Amendment'],
  },
  {
    term: 'Third Amendment — Engblom v. Carey',
    definition:
      '1982: National Guard members count as “soldiers,” so the Third Amendment can apply when the state houses them in people’s residences.',
    difficulty: 8,
    depends_on: ['Third Amendment'],
  },
  {
    term: 'Fourth Amendment — Mapp v. Ohio',
    definition:
      '1961: Evidence seized in an illegal search cannot be used in state criminal trials (the exclusionary rule).',
    difficulty: 6,
    depends_on: ['Fourth Amendment'],
  },
  {
    term: 'Fifth Amendment — Miranda v. Arizona',
    definition:
      '1966: Police must warn suspects in custody of the right to remain silent and the right to an attorney before questioning.',
    difficulty: 5,
    depends_on: ['Fifth Amendment'],
  },
  {
    term: 'Sixth Amendment — Gideon v. Wainwright',
    definition:
      '1963: States must provide a lawyer to criminal defendants who cannot afford one.',
    difficulty: 5,
    depends_on: ['Sixth Amendment'],
  },
  {
    term: 'Seventh Amendment — Feltner v. Columbia Pictures',
    definition:
      '1998: The Seventh Amendment requires a jury to decide statutory damages in a federal civil copyright case.',
    difficulty: 8,
    depends_on: ['Seventh Amendment'],
  },
  {
    term: 'Eighth Amendment — Furman v. Georgia',
    definition:
      '1972: The death penalty as then applied was cruel and unusual, so capital punishment was halted until states rewrote their laws.',
    difficulty: 7,
    depends_on: ['Eighth Amendment'],
  },
  {
    term: 'Ninth Amendment — Griswold v. Connecticut',
    definition:
      '1965: The Constitution protects a right to privacy (including marital contraception); the Ninth Amendment was cited to show that unenumerated rights exist.',
    difficulty: 7,
    depends_on: ['Ninth Amendment'],
  },
  {
    term: 'Tenth Amendment — United States v. Lopez',
    definition:
      '1995: Congress exceeded its commerce power by banning guns near schools, affirming that some powers are reserved to the states.',
    difficulty: 7,
    depends_on: ['Tenth Amendment'],
  },
];

export const SAMPLE_NOTES = [
  {
    id: 'psych-101',
    title: 'Psych 101 — Core Concepts',
    meta: 'Classical & operant conditioning, memory, perception',
    terms: 24,
  },
  {
    id: 'test-sample',
    title: 'Sample Test Notes',
    meta: 'Mixed terms for demo: cognition, biology, stats',
    terms: 18,
  },
  {
    id: 'history-civil-rights',
    title: 'History Civil Rights',
    meta: 'Bill of Rights: what each amendment means, plus a landmark case',
    terms: AMENDMENT_MEANINGS.length + AMENDMENT_CASES.length,
    items: [...AMENDMENT_MEANINGS, ...AMENDMENT_CASES],
  },
];
