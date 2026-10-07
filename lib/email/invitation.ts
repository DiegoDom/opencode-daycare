export interface InvitationEmailInput {
  parentName: string;
  childName: string;
  daycareName: string;
  code: string;
  link: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// HTML plano (sin dependencias de plantillas) con la paleta cálida de la app.
// El texto de usuarios se escapa; el código y el enlace van calculados en el server.
export function renderInvitationEmail(input: InvitationEmailInput): {
  subject: string;
  html: string;
} {
  const { parentName, childName, daycareName, code, link } = input;
  const name = escapeHtml(parentName);
  const child = escapeHtml(childName);
  const daycare = escapeHtml(daycareName);
  const codeText = escapeHtml(code);
  const href = escapeHtml(link);

  const subject = `${child} te ha invitado a ${daycare}`;
  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#FBF4EC;color:#3F362E;font-family:Nunito,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF4EC;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;background:#FFFFFF;border:1px solid #ECE0D0;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;font-weight:700;">Hola, ${name}</h1>
                <p style="margin:0;font-size:15px;line-height:1.5;color:#94887B;">
                  ${child} te invitó a seguir su día en <strong style="color:#3F362E;">${daycare}</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;">
                <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.7px;font-weight:800;color:#A88526;">CÓDIGO DE INVITACIÓN</p>
                <p style="margin:0;font-size:30px;letter-spacing:6px;font-weight:700;color:#8A7234;">${codeText}</p>
                <p style="margin:10px 0 0;font-size:13px;color:#A88526;">Vence en 7 días</p>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 16px;">
                <a href="${href}" style="display:inline-block;background:linear-gradient(180deg,#F4977E,#EE8164);color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:800;padding:13px 24px;border-radius:14px;">
                  Activar mi cuenta
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 28px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#A89A8B;">
                  No pudiste usar el enlace? Abrí <a href="${href}" style="color:#EE8164;">${link}</a> en tu navegador e ingresá el código ${codeText} para activar tu cuenta.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}