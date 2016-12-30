With a few more tweaks I may publish this to npm, since it doesn't seem like other
implementations are keeping full parity with Redux.

My only other divergence from the base implementation is to prefer `forEach` over
`for` loops, since the latter are simply less easy to read; the performance hit
should be minor at worst.

## TODO

* add support for `Immutable.Record` actions