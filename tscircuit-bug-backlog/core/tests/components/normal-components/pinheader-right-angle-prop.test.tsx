import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("<pinheader rightAngle /> produces a right-angle pinrow footprint", () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width="20mm" height="10mm" routingDisabled>
      <pinheader name="J1" pinCount={3} rightAngle />
    </board>,
  )

  circuit.render()

  const [cadComponent] = circuit.db.cad_component.list()
  const [pcbComponent] = circuit.db.pcb_component.list()

  expect(cadComponent.footprinter_string).toContain("_rightangle")
  // A right-angle header is not inserted from above
  expect(pcbComponent.insertion_direction).toBeUndefined()
})
