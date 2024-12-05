import Link from "next/link";
import React, { Children } from "react";
import { usePathname } from "next/navigation";

const ActiveLink = (propsparam) => {
  const { children, activeClassName, ...props } = propsparam;
  const  asPath  = usePathname();
  const child = Children.only(children);
  const childClassName = child.props.className || "";

  var propMatch = props.validRegexString ? props.validRegexString : "a^";
  var regex = new RegExp(propMatch, "i");

  const className =
    asPath === props.href || asPath === props.as || regex.test(asPath)
      ? `${childClassName} ${activeClassName}`.trim()
      : childClassName;

  return (
    <Link {...props}>
      {React.cloneElement(child, {
        className: className || null,
      })}
    </Link>
  );
};

export default ActiveLink;
