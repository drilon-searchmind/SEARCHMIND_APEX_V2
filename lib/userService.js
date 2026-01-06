import User from "../models/User";

/**
 * Get a single user by ID, excluding sensitive fields
 */
export async function getUserSafeById(id) {
  const user = await User.findById(id).select("-password").lean();
  return user;
}

/**
 * Update user profile fields by ID. Only allows name, email, image, and password (if provided).
 * Uses document save to trigger pre-save hooks for password hashing.
 */
export async function updateUserProfileById(id, data) {
  const doc = await User.findById(id);
  if (!doc) return null;

  const { name, email, image, password } = data || {};

  if (typeof name === "string" && name.trim()) doc.name = name.trim();
  if (typeof email === "string" && email.trim()) doc.email = email.trim().toLowerCase();
  if (typeof image === "string") doc.image = image.trim();
  if (typeof password === "string" && password.trim().length > 0) {
    doc.password = password.trim();
  }

  // Do not allow changing admin/archive/external/sharedCustomers/createdAt here

  await doc.save();
  const safe = doc.toObject();
  delete safe.password;
  return safe;
}
