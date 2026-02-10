const personalizeMessage = (text, contact) => {
  if (!text || !contact) return text || "";

  // 1. Get direct values from contact
  const email = (contact.email || "").trim();
  const firstName = (contact.firstName || contact.name?.split(' ')[0] || "").trim();
  const lastName = (contact.lastName || contact.name?.split(' ').slice(1).join(' ') || "").trim();
  const name = (contact.name || (firstName + " " + lastName).trim() || email).trim();

  // 2. Clear mapping for all tags
  const map = {
    "email": email,
    "firstname": firstName,
    "first_name": firstName,
    "lastname": lastName,
    "last_name": lastName,
    "name": name,
    "fullname": name
  };

  let result = text;

  // 3. Robust Replacement Loop
  Object.keys(map).forEach(key => {
    const val = map[key];
    
    // Replace {{tag}} format
    const curlyRegex = new RegExp(`\\{\\{\\s?${key}\\s?\\}\\}`, 'gi');
    result = result.replace(curlyRegex, val);

    // Replace @tag format (Strongest regex for @email, @firstname etc)
    const atRegex = new RegExp(`@\\s?${key}\\b|@\\s?${key}(?=[^a-zA-Z0-9])`, 'gi');
    result = result.replace(atRegex, val);
  });

  return result;
};

// --- TEST CASES ---
const contact = {
    email: "mohdmohsin@example.com",
    firstName: "Mohsin",
    lastName: "Khan"
};

const tests = [
    "Hi @firstname, welcome!",
    "Your email is @email.",
    "Hello @ firstname (with space)",
    "Hi @email, testing comma",
    "Compare @firstname with @email"
];

console.log("--- PERSONALIZATION TEST RESULTS ---");
tests.forEach(t => {
    console.log(`Original: ${t}`);
    console.log(`Result  : ${personalizeMessage(t, contact)}`);
    console.log("------------------------------------");
});
