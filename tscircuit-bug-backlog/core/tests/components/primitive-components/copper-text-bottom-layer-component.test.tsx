import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("coppertext in a footprint flips to the bottom layer with its component", () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width="20mm" height="10mm" routingDisabled>
      <chip
        name="U1"
        layer="bottom"
        footprint={
          <footprint>
            <smtpad
              shape="rect"
              width={1}
              height={1}
              portHints={["1"]}
              pcbX={-2}
            />
            <coppertext text="CU" fontSize={1} pcbX={2} />
          </footprint>
        }
      />
    </board>,
  )

  circuit.render()

  const [smtpad] = circuit.db.pcb_smtpad.list()
  const [copperText] = circuit.db.pcb_copper_text.list()

  expect(smtpad.layer).toBe("bottom")
  expect(copperText.layer).toBe("bottom")
})
