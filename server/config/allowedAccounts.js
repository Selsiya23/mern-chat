
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const getAllowedEmails = () =>
  [
    process.env.ALLOWED_CHAT_EMAIL_A,
    process.env.ALLOWED_CHAT_EMAIL_B,
  ]
    .map(normalizeEmail)
    .filter(Boolean);

const isAllowedEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  const allowedEmails = getAllowedEmails();

  return (
    allowedEmails.length === 2 &&
    allowedEmails[0] !== allowedEmails[1] &&
    allowedEmails.includes(normalizedEmail)
  );
};

const isAllowedUser = (user) =>
  Boolean(user && isAllowedEmail(user.email));

module.exports = {
  normalizeEmail,
  getAllowedEmails,
  isAllowedEmail,
  isAllowedUser,
};
