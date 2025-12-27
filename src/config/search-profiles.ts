import { SearchProfile } from '../types';

export const searchProfiles: SearchProfile[] = [
  {
    id: 'family-mortgage-1room',
    name: 'Семейная ипотека 1-комн (28-34м², этаж 4-17, 8-12 млн)',
    url: 'https://xn--80aae5aibotfo5h.xn--p1ai/kvartiry/?property=%D1%81%D0%B5%D0%BC%D0%B5%D0%B9%D0%BD%D0%B0%D1%8F&floor[]=4;17&area[]=28;34&price[]=8;12&price_m[]=330.5;380.5&district=2594',
    enabled: true,
    notifyOnNew: true,
    notifyOnAvailable: true,
    notifyOnPriceChange: false,
  },
];

export const testProfileWithAvailable: SearchProfile = {
  id: 'test-with-available',
  name: 'ТЕСТ - страница с незабронированными',
  url: 'https://xn--80aae5aibotfo5h.xn--p1ai/kvartiry/?property=%D1%81%D0%B5%D0%BC%D0%B5%D0%B9%D0%BD%D0%B0%D1%8F&auction=N&booked=B&area[]=30;136&price[]=7;40&price_m[]=171.3;604.2&view=map',
  enabled: false,
  notifyOnNew: true,
  notifyOnAvailable: true,
  notifyOnPriceChange: false,
};

export function getEnabledProfiles(): SearchProfile[] {
  return searchProfiles.filter(profile => profile.enabled);
}

export function getProfileById(id: string): SearchProfile | undefined {
  return searchProfiles.find(profile => profile.id === id);
}
