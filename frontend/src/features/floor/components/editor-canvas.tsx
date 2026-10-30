import type Konva from "konva"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  Ellipse,
  Group,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva"

import { CANVAS, type TableLayout } from "@/features/floor/schemas/floor.ts"

export const GRID = 10
const MIN_SIZE = 40
const MAX_SIZE = 400

const snapTo = (value: number, on: boolean) =>
  on ? Math.round(value / GRID) * GRID : value
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function subscribeToThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ["class"] })
  return () => observer.disconnect()
}

/**
 * Canvas cannot read CSS variables, so the theme's tokens are resolved to
 * colours here, again whenever the theme class on <html> changes.
 */
function useThemeColors() {
  const themeClass = useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.className
  )
  return useMemo(() => {
    // themeClass is the dependency that makes this re-read after a theme switch.
    void themeClass
    const css = getComputedStyle(document.documentElement)
    const read = (name: string) => css.getPropertyValue(name).trim()
    return {
      card: read("--card"),
      border: read("--border"),
      primary: read("--primary"),
      foreground: read("--foreground"),
      muted: read("--muted-foreground"),
      accent: read("--accent"),
    }
  }, [themeClass])
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width ?? 0)
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * The floor editor's drawing surface: drag tables, resize and rotate the
 * selected one with the handles, tap empty floor to deselect. Coordinates
 * are the 1000×700 logical canvas; the stage scales to its container.
 */
export function EditorCanvas({
  tables,
  selectedId,
  onSelect,
  onChange,
  snap,
}: {
  tables: TableLayout[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (id: string, patch: Partial<TableLayout>) => void
  snap: boolean
}) {
  const colors = useThemeColors()
  const [container, width] = useWidth<HTMLDivElement>()
  const scale = width / CANVAS.width
  const transformer = useRef<Konva.Transformer>(null)
  const nodes = useRef(new Map<string, Konva.Group>())
  const selected = useMemo(
    () => tables.find((table) => table.id === selectedId),
    [tables, selectedId]
  )

  useEffect(() => {
    const node = selectedId ? nodes.current.get(selectedId) : undefined
    transformer.current?.nodes(node ? [node] : [])
    transformer.current?.getLayer()?.batchDraw()
  }, [selectedId, tables])

  return (
    <div
      ref={container}
      className="relative w-full overflow-hidden rounded-3xl border bg-card/60 shadow-(--shadow-soft)"
      style={{
        aspectRatio: `${CANVAS.width} / ${CANVAS.height}`,
        backgroundImage:
          "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        backgroundSize: `${GRID * 2 * scale}px ${GRID * 2 * scale}px`,
      }}
    >
      {width > 0 && (
        <Stage
          width={width}
          height={CANVAS.height * scale}
          onMouseDown={(event) =>
            event.target === event.target.getStage() && onSelect(null)
          }
          onTouchStart={(event) =>
            event.target === event.target.getStage() && onSelect(null)
          }
        >
          <Layer scaleX={scale} scaleY={scale}>
            {tables.map((table) => {
              const active = table.id === selectedId
              const round = table.shape === "round"
              return (
                <Group
                  key={table.id}
                  ref={(node) => {
                    if (node) nodes.current.set(table.id, node)
                    else nodes.current.delete(table.id)
                  }}
                  x={table.x}
                  y={table.y}
                  rotation={table.rotation}
                  draggable
                  onMouseDown={() => onSelect(table.id)}
                  onTap={() => onSelect(table.id)}
                  onDragStart={() => onSelect(table.id)}
                  onDragEnd={(event) => {
                    const node = event.target
                    const x = clamp(snapTo(node.x(), snap), 0, CANVAS.width)
                    const y = clamp(snapTo(node.y(), snap), 0, CANVAS.height)
                    node.position({ x, y })
                    onChange(table.id, { x, y })
                  }}
                  onTransformEnd={(event) => {
                    const node = event.target
                    const next = {
                      width: clamp(
                        snapTo(table.width * node.scaleX(), snap),
                        MIN_SIZE,
                        MAX_SIZE
                      ),
                      height: clamp(
                        snapTo(table.height * node.scaleY(), snap),
                        MIN_SIZE,
                        MAX_SIZE
                      ),
                      rotation:
                        ((Math.round(node.rotation()) % 360) + 360) % 360,
                      x: clamp(node.x(), 0, CANVAS.width),
                      y: clamp(node.y(), 0, CANVAS.height),
                    }
                    if (round) next.height = next.width
                    node.scale({ x: 1, y: 1 })
                    onChange(table.id, next)
                  }}
                >
                  {round ? (
                    <Ellipse
                      radiusX={table.width / 2}
                      radiusY={table.height / 2}
                      fill={active ? colors.accent : colors.card}
                      stroke={active ? colors.primary : colors.border}
                      strokeWidth={active ? 3 : 2}
                      shadowColor="black"
                      shadowOpacity={0.08}
                      shadowBlur={8}
                      shadowOffsetY={2}
                    />
                  ) : (
                    <Rect
                      x={-table.width / 2}
                      y={-table.height / 2}
                      width={table.width}
                      height={table.height}
                      cornerRadius={Math.min(table.width, table.height) * 0.14}
                      fill={active ? colors.accent : colors.card}
                      stroke={active ? colors.primary : colors.border}
                      strokeWidth={active ? 3 : 2}
                      shadowColor="black"
                      shadowOpacity={0.08}
                      shadowBlur={8}
                      shadowOffsetY={2}
                    />
                  )}
                  {/* Labels counter-rotate so they read upright. */}
                  <Group rotation={-table.rotation}>
                    <Text
                      text={table.label}
                      x={-60}
                      y={-16}
                      width={120}
                      align="center"
                      fontSize={22}
                      fontStyle="600"
                      fontFamily="Lexend Deca Variable, sans-serif"
                      fill={colors.foreground}
                      listening={false}
                    />
                    <Text
                      text={`${table.capacity} ◦`}
                      x={-60}
                      y={10}
                      width={120}
                      align="center"
                      fontSize={13}
                      fontFamily="Inter Variable, sans-serif"
                      fill={colors.muted}
                      listening={false}
                    />
                  </Group>
                </Group>
              )
            })}
          </Layer>
          {/* Unscaled, so its handles stay finger-sized whatever the zoom. */}
          <Layer>
            <Transformer
              ref={transformer}
              rotateEnabled
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              rotationSnapTolerance={8}
              keepRatio={selected?.shape === "round"}
              enabledAnchors={
                selected?.shape === "round"
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : undefined
              }
              anchorSize={20}
              anchorCornerRadius={10}
              anchorStroke={colors.primary}
              anchorFill={colors.card}
              borderStroke={colors.primary}
              rotateAnchorOffset={32}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < MIN_SIZE * scale ||
                newBox.height < MIN_SIZE * scale
                  ? oldBox
                  : newBox
              }
            />
          </Layer>
        </Stage>
      )}
    </div>
  )
}
