import {
  type ActionFunction,
  type LoaderFunction,
  type SerializeFrom,
} from "@remix-run/node";
import { useRevalidator } from "@remix-run/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type DialogContext<
  L extends LoaderFunction = LoaderFunction,
  A extends ActionFunction = ActionFunction,
> = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  loaderData: SerializeFrom<L>;
  actionData: SerializeFrom<A> | undefined;
  refetchData: () => void;
  onSubmit: (values: unknown) => void;
  error: string | null;
};

const dialogContext = createContext<DialogContext | null>(null);

export const useDialogWrapper = <
  L extends LoaderFunction = never,
  A extends ActionFunction = never,
>() => {
  const context = useContext<DialogContext<L, A> | null>(dialogContext);
  if (context === null) throw Error("useDialogWrapper missing Provider");
  return context;
};

export const RouteDialogWrapper = <
  L extends LoaderFunction,
  A extends ActionFunction,
>({
  children,
  url,
  open,
  setOpen,
}: {
  children: ReactNode;
  url: string;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const openRef = useRef(false);
  const revalidator = useRevalidator();
  const [loaderData, setLoaderData] = useState<SerializeFrom<L>>();
  const [actionData, setActionData] = useState<SerializeFrom<A>>();
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(url, {
      headers: { Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((json) => {
        setLoaderData(json as SerializeFrom<L>);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
        console.error(err);
      });
  }, [url]);

  useEffect(() => {
    if (open === openRef.current) return;

    if (open) {
      fetchData();
    } else {
      // timeout to allow animations to run
      setTimeout(() => {
        setLoaderData(undefined);
        setActionData(undefined);
        revalidator.revalidate();
      }, 100);
    }
    openRef.current = open;
  }, [open, revalidator, url]);

  const onSubmit = useCallback(
    (values: unknown) => {
      fetch(url, {
        method: "post",
        body: JSON.stringify(values),
      })
        .then((res) => res.json())
        .then((json: unknown) => {
          const newActionData = json;
          setActionData(newActionData as typeof actionData);
        })
        .catch((err: unknown) => {
          if (err instanceof Error) setError(err.message);
          console.error(err);
        });
    },
    [url],
  );

  if (loaderData === undefined) return null;

  return (
    <dialogContext.Provider
      value={{
        open,
        setOpen,
        loaderData,
        actionData,
        refetchData: fetchData,
        onSubmit,
        error,
      }}
    >
      {children}
    </dialogContext.Provider>
  );
};
