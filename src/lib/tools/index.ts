import { search_places, get_nearby, search_along_route } from "./places";
import { plan_route, compare_routes, multi_stop_trip } from "./routing";
import { estimate_toll, estimate_fuel, trip_summary } from "./costs";
import { get_weather, weather_along_route } from "./weather";
import { check_wallet, analyze_image, web_search } from "./misc";

export const tools = {
  search_places,
  plan_route,
  estimate_toll,
  estimate_fuel,
  get_nearby,
  trip_summary,
  analyze_image,
  check_wallet,
  compare_routes,
  get_weather,
  weather_along_route,
  multi_stop_trip,
  search_along_route,
  web_search,
};
