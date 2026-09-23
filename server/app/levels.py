"""Swiss HarmoS levels. French equivalents: 5H=CE2, 6H=CM1, 7H=CM2, 8H=6e, 9H=5e, 10H=4e, 11H=3e."""
LEVELS = ["5H", "6H", "7H", "8H", "9H", "10H", "11H"]
AVATARS = ["chouette", "dragon", "lyre", "trident", "laurier", "foudre"]


def level_index(level: str) -> int:
    return LEVELS.index(level)
