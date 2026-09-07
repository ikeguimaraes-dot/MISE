import Image from 'next/image'

export function MiseBrand() {
  return <span className="mise-brand" aria-label="MISE">
    <Image src="/brand/mise-logo-light.svg" width={108} height={39} alt="" aria-hidden="true" unoptimized />
  </span>
}
