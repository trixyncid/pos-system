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

/** A table is stored free; occupancy comes from the mock orders (db/orders.ts). */
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
    seated_at: null,
    guests: null,
    order_total: null,
    waiter: null,
    order_id: null,
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
