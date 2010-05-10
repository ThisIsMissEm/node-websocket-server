require 'rake'
require 'rubygems'
require 'json'

puts "---"


def to_node_json(obj)
  obj = obj.to_json
  # reformat it a bit
  obj.gsub!(/\"\}\]|\[\{|\}\,|\:\{|\:\[[^\{]|\{\"|\,\"|\:\{\"|\"\:|\"\}$/) {|s|
    case s
    when ",\"";     "\n, \""
    when "{\"";     "{ \""
    when ":{";      ":\n  {"
    when ":[";      ": [\n"
    when "},";      "}\n, "
    when "[{";      "[{ "
    when "\"}]";    "\" }]"
    when "\":";     "\": "
    when "\"}";     "\"\n}"
    else;           s
    end
  }
  # finally clean up arrays.
  obj.gsub!(/(.+\[.+)\n\,/, '\1,').gsub(/\}$/, "\n}")
end

desc "Release a new version to various places."
task :release => ['write:pkgspec', 'npm:publish'] do
  puts "Released!"
  puts ""
end

namespace :write do
  desc "Write the package.json file"
  task :pkgspec do
    version = `git describe`.match("v([0-9]+\.[0-9]+.\[0-9]+).*")[1]
    package = {
      :name => "websocket-server",
      :version => version,
      :author => "Micheil Smith <micheil@brandedcode.com>",
      :description => "A WebSocket server written in low-level node.js, 90-100% spec compatible.",
      :main => "./lib/ws",
      :engines => { :node => ">=0.1.94-0" },
      :licenses => [{ :type => "MIT", :url => "./LICENSE.md" }]
    }

    puts "Making package.json"
    f = File.new("package.json", "w+")
    f.write(to_node_json(package))
    f.close
    puts "-> Done"
  end
end

namespace :npm do
  desc "Publish to NPM"
  task :publish do
    puts "Publishing to NPM"
    system("set -v", "npm publish .", "set +v")
    puts "-> Done"
  end
end