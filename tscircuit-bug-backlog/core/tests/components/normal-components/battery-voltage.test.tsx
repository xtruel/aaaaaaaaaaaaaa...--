import { expect, test } from "bun:test"
import { any_circuit_element } from "circuit-json"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("<battery voltage /> is emitted on the source component", () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width="12mm" height="10mm" routingDisabled>
      <battery
        name="BT1"
        voltage="3.7V"
        capacity="1000mAh"
        footprint="axial_p0.3in"
      />
    </board>,
  )

  circuit.render()

  const battery = circuit.db.source_component
    .list()
    .find((c) => c.name === "BT1") as any

  expect(battery.voltage).toBe(3.7)
  expect(battery.capacity).toBe(1000)
  expect(any_circuit_element.safeParse(battery).success).toBe(true)
})
