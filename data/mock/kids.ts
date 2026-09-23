export type ParentRole = "Mamá" | "Papá" | "Tutor/a";
export type ParentStatus = "activa" | "invitación enviada";

export interface KidParent {
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  role: ParentRole;
  status: ParentStatus;
  statusLabel: "ACTIVA" | "PENDIENTE";
}

export interface KidNote {
  title: string;
  text: string;
}

export interface Kid {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  age: number;
  parentsCount: number;
  birthDate: string;
  room: string;
  enrollmentDate: string;
  badge?: { label: string; bg: string; text: string };
  note?: KidNote;
  parents: KidParent[];
}

export const kids: Kid[] = [
  {
    id: "mateo-fernandez",
    name: "Mateo Fernández",
    initials: "M",
    avatarBg: "#A9D9E8",
    avatarColor: "#1F7A93",
    age: 3,
    parentsCount: 2,
    birthDate: "12 mar 2022",
    room: "Soles",
    enrollmentDate: "feb 2025",
    badge: { label: "MANÍ", bg: "#FBD8CC", text: "#D9684A" },
    note: {
      title: "Alergias y notas",
      text: "Alergia al maní. Evitar frutos secos. Lleva inhalador en la mochila.",
    },
    parents: [
      {
        name: "Lucía Fernández",
        initials: "L",
        avatarBg: "#C9B6E8",
        avatarColor: "#FFFFFF",
        role: "Mamá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
      {
        name: "Diego Fernández",
        initials: "D",
        avatarBg: "#A9C7E8",
        avatarColor: "#FFFFFF",
        role: "Papá",
        status: "invitación enviada",
        statusLabel: "PENDIENTE",
      },
    ],
  },
  {
    id: "sofia-mendez",
    name: "Sofía Méndez",
    initials: "S",
    avatarBg: "#F4B8CC",
    avatarColor: "#C44A7A",
    age: 2,
    parentsCount: 1,
    birthDate: "14 nov 2023",
    room: "Soles",
    enrollmentDate: "mar 2025",
    parents: [
      {
        name: "Camila Méndez",
        initials: "C",
        avatarBg: "#F4B8CC",
        avatarColor: "#FFFFFF",
        role: "Mamá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
    ],
  },
  {
    id: "benjamin-ruiz",
    name: "Benjamín Ruiz",
    initials: "B",
    avatarBg: "#B9DEC4",
    avatarColor: "#3E8B62",
    age: 3,
    parentsCount: 2,
    birthDate: "02 feb 2022",
    room: "Soles",
    enrollmentDate: "mar 2024",
    parents: [
      {
        name: "Martina Ruiz",
        initials: "M",
        avatarBg: "#B9DEC4",
        avatarColor: "#FFFFFF",
        role: "Mamá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
      {
        name: "Joaquín Ruiz",
        initials: "J",
        avatarBg: "#A9C7E8",
        avatarColor: "#FFFFFF",
        role: "Papá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
    ],
  },
  {
    id: "valentina-soto",
    name: "Valentina Soto",
    initials: "V",
    avatarBg: "#F4DC8E",
    avatarColor: "#9A7B1E",
    age: 2,
    parentsCount: 0,
    birthDate: "25 jul 2023",
    room: "Soles",
    enrollmentDate: "ago 2024",
    parents: [],
  },
  {
    id: "tomas-diaz",
    name: "Tomás Díaz",
    initials: "T",
    avatarBg: "#C9B6E8",
    avatarColor: "#7B5FC0",
    age: 3,
    parentsCount: 1,
    birthDate: "18 ene 2022",
    room: "Soles",
    enrollmentDate: "feb 2025",
    badge: { label: "LACTOSA", bg: "#FBD8CC", text: "#D9684A" },
    note: {
      title: "Alergias y notas",
      text: "Intolerancia a la lactosa. Evitar lácteos y derivados. Tiene su propia leche sin lactosa.",
    },
    parents: [
      {
        name: "Mariana Díaz",
        initials: "M",
        avatarBg: "#C9B6E8",
        avatarColor: "#FFFFFF",
        role: "Mamá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
    ],
  },
  {
    id: "emma-castro",
    name: "Emma Castro",
    initials: "E",
    avatarBg: "#F4B8CC",
    avatarColor: "#C44A7A",
    age: 2,
    parentsCount: 1,
    birthDate: "09 oct 2023",
    room: "Soles",
    enrollmentDate: "mar 2025",
    parents: [
      {
        name: "Valeria Castro",
        initials: "V",
        avatarBg: "#F4B8CC",
        avatarColor: "#FFFFFF",
        role: "Mamá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
    ],
  },
  {
    id: "lucas-romero",
    name: "Lucas Romero",
    initials: "L",
    avatarBg: "#A9D9E8",
    avatarColor: "#1F7A93",
    age: 3,
    parentsCount: 1,
    birthDate: "30 abr 2022",
    room: "Soles",
    enrollmentDate: "ago 2024",
    parents: [
      {
        name: "Natalia Romero",
        initials: "N",
        avatarBg: "#A9D9E8",
        avatarColor: "#FFFFFF",
        role: "Mamá",
        status: "activa",
        statusLabel: "ACTIVA",
      },
    ],
  },
  {
    id: "olivia-vega",
    name: "Olivia Vega",
    initials: "O",
    avatarBg: "#B9DEC4",
    avatarColor: "#3E8B62",
    age: 2,
    parentsCount: 1,
    birthDate: "21 jun 2023",
    room: "Soles",
    enrollmentDate: "feb 2025",
    parents: [
      {
        name: "Rodrigo Vega",
        initials: "R",
        avatarBg: "#A9C7E8",
        avatarColor: "#FFFFFF",
        role: "Papá",
        status: "invitación enviada",
        statusLabel: "PENDIENTE",
      },
    ],
  },
];