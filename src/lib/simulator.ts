// Synthetic transaction generator — used for live demo stream
import { scoreTransaction, type TxFeatures } from "./scoring";

const MERCHANTS = [
  "Amazon", "Starbucks", "Uber", "Apple Store", "Netflix", "Spotify", "Whole Foods",
  "Best Buy", "Target", "Shell", "Walmart", "DoorDash", "Steam", "Nike",
  "Crypto.io Exchange", "Anonymous Wire Inc", "QuickCash ATM", "GoldBuyer Pro",
  "Luxury Watches Ltd", "Offshore Holdings",
];

const LOCATIONS = [
  { country: "US", city: "San Francisco", lat: 37.77, lng: -122.42 },
  { country: "US", city: "New York", lat: 40.71, lng: -74.01 },
  { country: "US", city: "Austin", lat: 30.27, lng: -97.74 },
  { country: "GB", city: "London", lat: 51.51, lng: -0.13 },
  { country: "DE", city: "Berlin", lat: 52.52, lng: 13.40 },
  { country: "JP", city: "Tokyo", lat: 35.68, lng: 139.69 },
  { country: "BR", city: "São Paulo", lat: -23.55, lng: -46.63 },
  { country: "NG", city: "Lagos", lat: 6.45, lng: 3.40 },
  { country: "RU", city: "Moscow", lat: 55.75, lng: 37.62 },
  { country: "CN", city: "Shanghai", lat: 31.23, lng: 121.47 },
  { country: "MX", city: "Mexico City", lat: 19.43, lng: -99.13 },
  { country: "AE", city: "Dubai", lat: 25.20, lng: 55.27 },
];

const MCCS = ["5411", "5812", "5732", "4111", "5942", "5999", "6011", "7995"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export type SyntheticTx = {
  card_id: string;
  amount: number;
  merchant: string;
  mcc: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  features: TxFeatures;
  fraud_score: number;
  is_fraud_pred: boolean;
  reason: string;
  status: "pending" | "approved" | "flagged" | "blocked";
};

export function generateTransaction(cardIds: string[], forceFraud = false): SyntheticTx {
  const cardId = pick(cardIds);
  const fraud = forceFraud || Math.random() < 0.18;

  const loc = fraud && Math.random() < 0.6
    ? pick(LOCATIONS.slice(7)) // higher-risk locales for fraud
    : pick(LOCATIONS.slice(0, 6));
  const merchant = fraud && Math.random() < 0.5 ? pick(MERCHANTS.slice(14)) : pick(MERCHANTS.slice(0, 14));
  const amount = fraud
    ? Math.round((50 + Math.pow(Math.random(), 2) * 4900) * 100) / 100
    : Math.round((4 + Math.random() * 240) * 100) / 100;

  const features: TxFeatures = {
    amount,
    hour: fraud && Math.random() < 0.4 ? Math.floor(Math.random() * 5) : new Date().getHours(),
    country: loc.country,
    city: loc.city,
    merchant,
    mcc: pick(MCCS),
    cardId,
    velocityLast1h: fraud ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 3),
    amountZScore: fraud ? (Math.random() * 5 + 1) * (Math.random() < 0.5 ? 1 : -1) : Math.random() * 1.5 - 0.75,
    geoJumpKm: fraud && Math.random() < 0.5 ? Math.random() * 8000 + 500 : Math.random() * 200,
    newMerchant: Math.random() < (fraud ? 0.6 : 0.15),
    newCountry: fraud && Math.random() < 0.5,
  };

  const result = scoreTransaction(features);

  return {
    card_id: cardId,
    amount,
    merchant,
    mcc: features.mcc!,
    country: loc.country,
    city: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    features,
    fraud_score: result.score,
    is_fraud_pred: result.isFraud,
    reason: result.reason,
    status: result.score >= 0.85 ? "blocked" : result.score >= 0.65 ? "flagged" : "approved",
  };
}
