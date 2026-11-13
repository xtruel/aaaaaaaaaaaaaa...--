import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("<pinheader holeDiameter platedDiameter /> without pitch still gets a footprint", () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width="20mm" height="10mm" routingDisabled>
      <pinheader
        name="J1"
        pinCount={3}
        holeDiameter="1.2mm"
        platedDiameter="2mm"
      />
    </board>,
  )

  circuit.render()

  const platedHoles = circuit.db.pcb_plated_hole.list()
  expect(platedHoles).toHaveLength(3)
  expect(platedHoles[0]).toMatchObject({
    hole_diameter: 1.2,
    rect_pad_width: 2,
  })

  const errors = circuit
    .getCircuitJson()
    .filter((e) => e.type.endsWith("_error"))
  expect(errors).toEqual([])
})
