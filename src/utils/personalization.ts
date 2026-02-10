
export const personalizeMessage = (
  text: string,
  contact: { 
    firstName?: string; 
    lastName?: string; 
    name?: string; 
    email: string 
  }
): string => {
  const fn = (contact.firstName ?? contact.name?.split(' ')[0] ?? '').trim();
  const ln = (contact.lastName ?? contact.name?.split(' ').slice(1).join(' ') ?? '').trim();
  const fullName = [fn, ln].filter(Boolean).join(' ') || (contact.name ?? '');

  const replaceMap: Record<string, string> = {
      '{{name}}': fullName,
      '{{firstName}}': fn,
      '{{lastName}}': ln,
      '{{email}}': contact.email || '',
      '@name': fullName,
      '@firstName': fn,
      '@lastName': ln,
      '@firstname': fn,
      '@lastname': ln,
  };

  let result = text;
  Object.keys(replaceMap).forEach(key => {
      const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(regex, replaceMap[key]);
  });

  return result;
};
