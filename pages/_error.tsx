import type { NextPageContext } from "next";

const statusCodes: Record<number, string> = {
  400: "Bad Request",
  404: "This page could not be found",
  500: "Internal Server Error",
};

type ErrorProps = {
  statusCode?: number;
  title?: string;
};

function Error({ statusCode = 404, title }: ErrorProps) {
  const message = title || statusCodes[statusCode] || "An unexpected error has occurred";
  return (
    <div
      style={{
        fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <h1>{statusCode}</h1>
      <p>{message}</p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default Error;
