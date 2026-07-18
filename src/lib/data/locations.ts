/**
 * Curated location suggestions for autocomplete fields (current city,
 * preferred locations, etc). India-first, with major global hubs included
 * for users targeting international or remote roles. This is a static,
 * hand-curated list of real places — not exhaustive, but broad enough to
 * cover the country's major metros, state capitals, and well-known
 * secondary/tertiary cities across every state and union territory.
 *
 * Kept as plain data (no external geocoding API) so search is instant and
 * has no network dependency or usage cost.
 */
export interface LocationSuggestion {
  city: string;
  state: string;
  country: string;
}

export const INDIA_LOCATIONS: LocationSuggestion[] = [
  // Andhra Pradesh
  { city: "Visakhapatnam", state: "Andhra Pradesh", country: "India" },
  { city: "Vijayawada", state: "Andhra Pradesh", country: "India" },
  { city: "Guntur", state: "Andhra Pradesh", country: "India" },
  { city: "Nellore", state: "Andhra Pradesh", country: "India" },
  { city: "Tirupati", state: "Andhra Pradesh", country: "India" },
  { city: "Kakinada", state: "Andhra Pradesh", country: "India" },
  { city: "Rajahmundry", state: "Andhra Pradesh", country: "India" },
  { city: "Kurnool", state: "Andhra Pradesh", country: "India" },
  // Arunachal Pradesh
  { city: "Itanagar", state: "Arunachal Pradesh", country: "India" },
  // Assam
  { city: "Guwahati", state: "Assam", country: "India" },
  { city: "Dibrugarh", state: "Assam", country: "India" },
  { city: "Silchar", state: "Assam", country: "India" },
  { city: "Jorhat", state: "Assam", country: "India" },
  // Bihar
  { city: "Patna", state: "Bihar", country: "India" },
  { city: "Gaya", state: "Bihar", country: "India" },
  { city: "Bhagalpur", state: "Bihar", country: "India" },
  { city: "Muzaffarpur", state: "Bihar", country: "India" },
  { city: "Darbhanga", state: "Bihar", country: "India" },
  // Chhattisgarh
  { city: "Raipur", state: "Chhattisgarh", country: "India" },
  { city: "Bhilai", state: "Chhattisgarh", country: "India" },
  { city: "Bilaspur", state: "Chhattisgarh", country: "India" },
  { city: "Korba", state: "Chhattisgarh", country: "India" },
  { city: "Durg", state: "Chhattisgarh", country: "India" },
  // Goa
  { city: "Panaji", state: "Goa", country: "India" },
  { city: "Margao", state: "Goa", country: "India" },
  { city: "Vasco da Gama", state: "Goa", country: "India" },
  // Gujarat
  { city: "Ahmedabad", state: "Gujarat", country: "India" },
  { city: "Surat", state: "Gujarat", country: "India" },
  { city: "Vadodara", state: "Gujarat", country: "India" },
  { city: "Rajkot", state: "Gujarat", country: "India" },
  { city: "Bhavnagar", state: "Gujarat", country: "India" },
  { city: "Jamnagar", state: "Gujarat", country: "India" },
  { city: "Gandhinagar", state: "Gujarat", country: "India" },
  { city: "Anand", state: "Gujarat", country: "India" },
  // Haryana
  { city: "Gurugram", state: "Haryana", country: "India" },
  { city: "Faridabad", state: "Haryana", country: "India" },
  { city: "Panipat", state: "Haryana", country: "India" },
  { city: "Ambala", state: "Haryana", country: "India" },
  { city: "Hisar", state: "Haryana", country: "India" },
  { city: "Karnal", state: "Haryana", country: "India" },
  { city: "Rohtak", state: "Haryana", country: "India" },
  // Himachal Pradesh
  { city: "Shimla", state: "Himachal Pradesh", country: "India" },
  { city: "Dharamshala", state: "Himachal Pradesh", country: "India" },
  { city: "Manali", state: "Himachal Pradesh", country: "India" },
  // Jharkhand
  { city: "Ranchi", state: "Jharkhand", country: "India" },
  { city: "Jamshedpur", state: "Jharkhand", country: "India" },
  { city: "Dhanbad", state: "Jharkhand", country: "India" },
  { city: "Bokaro", state: "Jharkhand", country: "India" },
  // Karnataka
  { city: "Bengaluru", state: "Karnataka", country: "India" },
  { city: "Mysuru", state: "Karnataka", country: "India" },
  { city: "Mangaluru", state: "Karnataka", country: "India" },
  { city: "Hubballi", state: "Karnataka", country: "India" },
  { city: "Belagavi", state: "Karnataka", country: "India" },
  { city: "Davanagere", state: "Karnataka", country: "India" },
  // Kerala
  { city: "Thiruvananthapuram", state: "Kerala", country: "India" },
  { city: "Kochi", state: "Kerala", country: "India" },
  { city: "Kozhikode", state: "Kerala", country: "India" },
  { city: "Thrissur", state: "Kerala", country: "India" },
  { city: "Kollam", state: "Kerala", country: "India" },
  { city: "Kannur", state: "Kerala", country: "India" },
  // Madhya Pradesh
  { city: "Bhopal", state: "Madhya Pradesh", country: "India" },
  { city: "Indore", state: "Madhya Pradesh", country: "India" },
  { city: "Jabalpur", state: "Madhya Pradesh", country: "India" },
  { city: "Gwalior", state: "Madhya Pradesh", country: "India" },
  { city: "Ujjain", state: "Madhya Pradesh", country: "India" },
  { city: "Bhind", state: "Madhya Pradesh", country: "India" },
  { city: "Sagar", state: "Madhya Pradesh", country: "India" },
  { city: "Satna", state: "Madhya Pradesh", country: "India" },
  // Maharashtra
  { city: "Mumbai", state: "Maharashtra", country: "India" },
  { city: "Pune", state: "Maharashtra", country: "India" },
  { city: "Nagpur", state: "Maharashtra", country: "India" },
  { city: "Nashik", state: "Maharashtra", country: "India" },
  { city: "Thane", state: "Maharashtra", country: "India" },
  { city: "Aurangabad", state: "Maharashtra", country: "India" },
  { city: "Bhiwandi", state: "Maharashtra", country: "India" },
  { city: "Solapur", state: "Maharashtra", country: "India" },
  { city: "Kolhapur", state: "Maharashtra", country: "India" },
  { city: "Navi Mumbai", state: "Maharashtra", country: "India" },
  { city: "Amravati", state: "Maharashtra", country: "India" },
  // Manipur
  { city: "Imphal", state: "Manipur", country: "India" },
  // Meghalaya
  { city: "Shillong", state: "Meghalaya", country: "India" },
  // Mizoram
  { city: "Aizawl", state: "Mizoram", country: "India" },
  // Nagaland
  { city: "Kohima", state: "Nagaland", country: "India" },
  { city: "Dimapur", state: "Nagaland", country: "India" },
  // Odisha
  { city: "Bhubaneswar", state: "Odisha", country: "India" },
  { city: "Cuttack", state: "Odisha", country: "India" },
  { city: "Rourkela", state: "Odisha", country: "India" },
  { city: "Berhampur", state: "Odisha", country: "India" },
  // Punjab
  { city: "Chandigarh", state: "Punjab", country: "India" },
  { city: "Ludhiana", state: "Punjab", country: "India" },
  { city: "Amritsar", state: "Punjab", country: "India" },
  { city: "Jalandhar", state: "Punjab", country: "India" },
  { city: "Patiala", state: "Punjab", country: "India" },
  { city: "Mohali", state: "Punjab", country: "India" },
  // Rajasthan
  { city: "Jaipur", state: "Rajasthan", country: "India" },
  { city: "Jodhpur", state: "Rajasthan", country: "India" },
  { city: "Udaipur", state: "Rajasthan", country: "India" },
  { city: "Kota", state: "Rajasthan", country: "India" },
  { city: "Ajmer", state: "Rajasthan", country: "India" },
  { city: "Bikaner", state: "Rajasthan", country: "India" },
  // Sikkim
  { city: "Gangtok", state: "Sikkim", country: "India" },
  // Tamil Nadu
  { city: "Chennai", state: "Tamil Nadu", country: "India" },
  { city: "Coimbatore", state: "Tamil Nadu", country: "India" },
  { city: "Madurai", state: "Tamil Nadu", country: "India" },
  { city: "Tiruchirappalli", state: "Tamil Nadu", country: "India" },
  { city: "Salem", state: "Tamil Nadu", country: "India" },
  { city: "Tirunelveli", state: "Tamil Nadu", country: "India" },
  { city: "Vellore", state: "Tamil Nadu", country: "India" },
  // Telangana
  { city: "Hyderabad", state: "Telangana", country: "India" },
  { city: "Warangal", state: "Telangana", country: "India" },
  { city: "Nizamabad", state: "Telangana", country: "India" },
  // Tripura
  { city: "Agartala", state: "Tripura", country: "India" },
  // Uttar Pradesh
  { city: "Lucknow", state: "Uttar Pradesh", country: "India" },
  { city: "Kanpur", state: "Uttar Pradesh", country: "India" },
  { city: "Noida", state: "Uttar Pradesh", country: "India" },
  { city: "Ghaziabad", state: "Uttar Pradesh", country: "India" },
  { city: "Agra", state: "Uttar Pradesh", country: "India" },
  { city: "Varanasi", state: "Uttar Pradesh", country: "India" },
  { city: "Meerut", state: "Uttar Pradesh", country: "India" },
  { city: "Prayagraj", state: "Uttar Pradesh", country: "India" },
  { city: "Bareilly", state: "Uttar Pradesh", country: "India" },
  { city: "Aligarh", state: "Uttar Pradesh", country: "India" },
  { city: "Gorakhpur", state: "Uttar Pradesh", country: "India" },
  // Uttarakhand
  { city: "Dehradun", state: "Uttarakhand", country: "India" },
  { city: "Haridwar", state: "Uttarakhand", country: "India" },
  { city: "Roorkee", state: "Uttarakhand", country: "India" },
  // West Bengal
  { city: "Kolkata", state: "West Bengal", country: "India" },
  { city: "Howrah", state: "West Bengal", country: "India" },
  { city: "Durgapur", state: "West Bengal", country: "India" },
  { city: "Asansol", state: "West Bengal", country: "India" },
  { city: "Siliguri", state: "West Bengal", country: "India" },
  // Union Territories
  { city: "New Delhi", state: "Delhi", country: "India" },
  { city: "Puducherry", state: "Puducherry", country: "India" },
  { city: "Srinagar", state: "Jammu and Kashmir", country: "India" },
  { city: "Jammu", state: "Jammu and Kashmir", country: "India" },
  { city: "Leh", state: "Ladakh", country: "India" },
];

export const GLOBAL_LOCATIONS: LocationSuggestion[] = [
  { city: "Remote", state: "", country: "Global" },
  { city: "New York", state: "New York", country: "United States" },
  { city: "San Francisco", state: "California", country: "United States" },
  { city: "Seattle", state: "Washington", country: "United States" },
  { city: "Austin", state: "Texas", country: "United States" },
  { city: "Chicago", state: "Illinois", country: "United States" },
  { city: "Boston", state: "Massachusetts", country: "United States" },
  { city: "Los Angeles", state: "California", country: "United States" },
  { city: "London", state: "England", country: "United Kingdom" },
  { city: "Manchester", state: "England", country: "United Kingdom" },
  { city: "Toronto", state: "Ontario", country: "Canada" },
  { city: "Vancouver", state: "British Columbia", country: "Canada" },
  { city: "Sydney", state: "New South Wales", country: "Australia" },
  { city: "Melbourne", state: "Victoria", country: "Australia" },
  { city: "Singapore", state: "", country: "Singapore" },
  { city: "Dubai", state: "", country: "United Arab Emirates" },
  { city: "Abu Dhabi", state: "", country: "United Arab Emirates" },
  { city: "Berlin", state: "", country: "Germany" },
  { city: "Munich", state: "", country: "Germany" },
  { city: "Amsterdam", state: "", country: "Netherlands" },
  { city: "Dublin", state: "", country: "Ireland" },
  { city: "Paris", state: "", country: "France" },
];

export const ALL_LOCATIONS: LocationSuggestion[] = [...INDIA_LOCATIONS, ...GLOBAL_LOCATIONS];

export function formatLocationLabel(loc: LocationSuggestion): string {
  return [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
}

/** Case-insensitive prefix + substring match on city name, state, or country. */
export function searchLocations(query: string, limit = 8): LocationSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: LocationSuggestion[] = [];
  const contains: LocationSuggestion[] = [];
  for (const loc of ALL_LOCATIONS) {
    const city = loc.city.toLowerCase();
    if (city.startsWith(q)) {
      starts.push(loc);
    } else if (
      city.includes(q) ||
      loc.state.toLowerCase().includes(q) ||
      loc.country.toLowerCase().includes(q)
    ) {
      contains.push(loc);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
