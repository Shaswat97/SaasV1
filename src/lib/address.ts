export type AddressInput = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export function toAddressFields(prefix: "billing" | "shipping", address?: AddressInput) {
  if (!address) return {};

  return {
    [`${prefix}Line1`]: address.line1,
    [`${prefix}Line2`]: address.line2,
    [`${prefix}City`]: address.city,
    [`${prefix}State`]: address.state,
    [`${prefix}PostalCode`]: address.postalCode,
    [`${prefix}Country`]: address.country
  } as Record<string, string | undefined>;
}
