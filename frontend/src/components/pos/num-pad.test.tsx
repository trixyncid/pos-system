import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NumPad } from "@/components/pos/num-pad.tsx"

describe("NumPad", () => {
  it("types digits by touch and by keyboard, and deletes", async () => {
    const onDigit = vi.fn()
    const onBackspace = vi.fn()
    render(
      <NumPad
        keyboard
        onDigit={onDigit}
        onBackspace={onBackspace}
        deleteLabel="Hapus angka"
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "7" }))
    await user.keyboard("3")
    await user.click(screen.getByRole("button", { name: "Hapus angka" }))
    expect(onDigit.mock.calls).toEqual([["7"], ["3"]])
    expect(onBackspace).toHaveBeenCalledOnce()
  })
})
