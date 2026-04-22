from __future__ import annotations

import export_drawio_library
import export_drawio_batch
import generate_remaining_diagrams


def main() -> None:
    export_drawio_library.main()
    export_drawio_batch.main()
    generate_remaining_diagrams.main()


if __name__ == "__main__":
    main()