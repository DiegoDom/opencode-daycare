export type PostType = "logro" | "actividad" | "anuncio";

export interface Post {
  id: string;
  type: PostType;
  author: {
    name: string;
    initials: string;
    avatarBg: string;
    avatarColor: string;
  };
  time: string;
  publishedBy: string;
  audience: string;
  body: string;
  photo?: { label: string };
  likes: number;
  comments: number;
}

export interface FeedData {
  roomLabel: string;
  greeting: string;
  childrenLine: string;
  composePlaceholder: string;
  currentUser: { name: string; initials: string; role: string };
  posts: Post[];
}

export const feedData: FeedData = {
  roomLabel: "GUARDERÍA · SALA SOLES",
  greeting: "Buenas, Caro",
  childrenLine: "12 niños · martes 17 jun",
  composePlaceholder: "Compartí un momento…",
  currentUser: { name: "Caro Giménez", initials: "C", role: "Maestra · Soles" },
  posts: [
    {
      id: "post-1",
      type: "logro",
      author: {
        name: "Mateo",
        initials: "M",
        avatarBg: "#A9D9E8",
        avatarColor: "#1F7A93",
      },
      time: "14:20",
      publishedBy: "publicado por vos",
      audience: "Para: familia de Mateo",
      body: "¡Usó el orinal solito por primera vez! Estaba feliz de contárselo a todos. Un gran paso.",
      likes: 3,
      comments: 1,
    },
    {
      id: "post-2",
      type: "actividad",
      author: {
        name: "Mateo",
        initials: "M",
        avatarBg: "#A9D9E8",
        avatarColor: "#1F7A93",
      },
      time: "09:40",
      publishedBy: "publicado por vos",
      audience: "Para: familia de Mateo",
      body: "Pintamos con témperas esta mañana. Mateo eligió el azul para todo y se concentró un montón mezclando colores.",
      photo: { label: "Foto · pintando con témperas" },
      likes: 5,
      comments: 2,
    },
    {
      id: "post-3",
      type: "anuncio",
      author: {
        name: "Anuncio general",
        initials: "",
        avatarBg: "#CCD8F4",
        avatarColor: "#4E72C8",
      },
      time: "07:50",
      publishedBy: "publicado por vos",
      audience: "Para: toda la sala",
      body: "El viernes salimos al parque por la mañana. Recuerden mandar gorra y una botellita de agua.",
      likes: 8,
      comments: 0,
    },
  ],
};