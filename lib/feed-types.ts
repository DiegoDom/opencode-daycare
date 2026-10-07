export type PostType =
  | "comida"
  | "siesta"
  | "actividad"
  | "logro"
  | "animo"
  | "foto"
  | "anuncio";

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
  recipients?: {
    name: string;
    initials: string;
    avatarBg: string;
    avatarColor: string;
  }[];
  body: string;
  photos?: { src: string }[];
  likes: number;
  comments: number;
}
