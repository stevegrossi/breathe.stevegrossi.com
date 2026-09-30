# breathe.stevegrossi.com

A small, simple client-side app for generating and playing breathwork exercises. Visit breathe.stevegrossi.com to create one, or [try one of my favorites](https://breathe.stevegrossi.com/8m8s1x8i4e45h1x8i8e8m8s1x8i4e60h1x8i8e8m8s1x8i4e75h1x8i8e?bpm=50).

## The Notation

Exercises are written as a sequence of `<number><letter>` atoms, with no separators. The letter marks the end of each number.

| Form | Meaning |
| --- | --- |
| `Ns`, `Nm`, `Nl` | `N` breaths with equal inhale and exhale phases of 1 (**s**hort), 2 (**m**edium), or 4 (**l**ong) beats. |
| `Nx...` | `N` breaths with an explicit phase pattern: `Ni` inhale, `Np` pause, and `Ne` exhale. The inhale and exhale are required; pauses are optional. |
| `Nh` | Hold for `N` seconds. A hold separates rounds. |

Each beat lasts `60 / bpm` seconds. Phase lengths are independent, so `4i7p8e`
means inhale for 4 beats, pause for 7, and exhale for 8. For example,
`8m8s45h` means 8 medium breaths, 8 short breaths, then a 45-second hold;
`4x4i4p4e4p` is box breathing.
