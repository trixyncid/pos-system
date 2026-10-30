import type { Area, FloorTable } from "@/features/floor/schemas/floor.ts"
import { mockId } from "@/mocks/db/catalog.ts"

type Seed = [
  label: string,
  shape: "rect" | "round",
  x: number,
  y: number,
  w: number,
  h: number,
  capacity: number,
  rotation?: number,
]

/** Live state for some tables, so the floor view has something to show. Minutes are "seated this long ago". */
const occupancy: Record<string, Partial<FloorTable> & { minutes?: number }> = {
  "2": {
    status: "ordered",
    minutes: 34,
    guests: 2,
    order_total: 86_000,
    waiter: "Sari",
  },
  "5": {
    status: "ordered",
    minutes: 61,
    guests: 4,
    order_total: 214_500,
    waiter: "Agus",
  },
  "6": { status: "occupied", minutes: 4, guests: 3, waiter: "Sari" },
  "8": {
    status: "billed",
    minutes: 78,
    guests: 7,
    order_total: 512_000,
    waiter: "Agus",
  },
  "10": { status: "cleaning" },
  "12": {
    status: "ordered",
    minutes: 18,
    guests: 4,
    order_total: 142_000,
    waiter: "Sari",
  },
  "15": { status: "occupied", minutes: 9, guests: 2, waiter: "Agus" },
}

function table([
  label,
  shape,
  x,
  y,
  width,
  height,
  capacity,
  rotation = 0,
]: Seed): FloorTable {
  const live = occupancy[label] ?? {}
  const { minutes, ...state } = live
  return {
    id: mockId(),
    label,
    shape,
    x,
    y,
    width,
    height,
    rotation,
    capacity,
    status: "available",
    seated_at:
      minutes === undefined
        ? null
        : new Date(Date.now() - minutes * 60_000).toISOString(),
    guests: null,
    order_total: null,
    waiter: null,
    ...state,
  }
}

function area(name: string, sort_order: number, seeds: Seed[]): Area {
  return {
    id: mockId(),
    name,
    sort_order,
    is_active: true,
    tables: seeds.map(table),
  }
}

/** x and y are the table's centre on the 1000×700 canvas. */
export const areas: Area[] = [
  area("Indoor", 0, [
    ["1", "round", 130, 110, 90, 90, 2],
    ["2", "round", 300, 110, 90, 90, 2],
    ["3", "round", 470, 110, 90, 90, 2],
    ["4", "round", 640, 110, 90, 90, 2],
    ["5", "rect", 160, 300, 130, 90, 4],
    ["6", "rect", 380, 300, 130, 90, 4],
    ["7", "rect", 600, 300, 130, 90, 4],
    ["8", "rect", 850, 230, 120, 230, 8],
    ["9", "rect", 200, 540, 170, 110, 6],
    ["10", "rect", 470, 540, 170, 110, 6],
    ["11", "rect", 780, 560, 90, 90, 2, 45],
  ]),
  area("Teras", 1, [
    ["12", "round", 200, 170, 110, 110, 4],
    ["13", "round", 500, 170, 110, 110, 4],
    ["14", "round", 800, 170, 110, 110, 4],
    ["15", "round", 200, 470, 110, 110, 4],
    ["16", "round", 500, 470, 110, 110, 4],
    ["17", "rect", 800, 470, 150, 100, 6],
  ]),
]
